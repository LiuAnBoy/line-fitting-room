import { messagingApi } from "@line/bot-sdk";

import LineProvider from "../../providers/line";
import ConsoleHandler from "../../utils/consoleHandler";
import AIService from "../aiService";
import ConfigService from "../configService";
import { FlowEvent } from "../flowManagerService";
import ImageCacheService from "../imageCacheService";
import ReplyService from "../replyService";
import UserStateService, { USER_STATES, UserState } from "../userStateService";
import EventRouterService from "./eventRouterService";
import ImageMessageHandlerService from "./imageMessageHandlerService";
import TextMessageHandlerService from "./textMessageHandlerService";

/**
 * @class FlowOrchestratorService
 * @description Main coordinator service that orchestrates all flow-related services
 * Replaces the monolithic FlowManagerService with a clean separation of concerns
 */
class FlowOrchestratorService {
  private static instance: FlowOrchestratorService;
  private logger = ConsoleHandler.getInstance("FlowOrchestratorService");

  // Service dependencies
  private userStateService: UserStateService;
  private replyService: ReplyService;
  private imageCacheService: ImageCacheService;
  private aiService: AIService;
  private lineProvider: LineProvider;
  private config: ConfigService;

  // Specialized flow services
  private eventRouter: EventRouterService;
  private textHandler: TextMessageHandlerService;
  private imageHandler: ImageMessageHandlerService;

  /**
   * Private constructor for the Singleton pattern.
   * Initializes all service dependencies and specialized flow handlers
   * Creates clean separation between core services and flow-specific logic
   * @private
   */
  private constructor() {
    // Initialize core services
    this.userStateService = UserStateService.getInstance();
    this.replyService = ReplyService.getInstance();
    this.imageCacheService = ImageCacheService.getInstance();
    this.aiService = AIService.getInstance();
    this.lineProvider = LineProvider.getInstance();
    this.config = ConfigService.getInstance();

    // Initialize specialized flow services
    this.eventRouter = EventRouterService.getInstance();
    this.textHandler = TextMessageHandlerService.getInstance();
    this.imageHandler = ImageMessageHandlerService.getInstance();
  }

  /**
   * Gets the singleton instance of the FlowOrchestratorService.
   * Ensures single orchestrator for consistent flow coordination across the application
   * @returns {FlowOrchestratorService} The singleton instance
   * @static
   */
  public static getInstance(): FlowOrchestratorService {
    if (!FlowOrchestratorService.instance) {
      FlowOrchestratorService.instance = new FlowOrchestratorService();
    }
    return FlowOrchestratorService.instance;
  }

  /**
   * Main entry point for processing flow events
   * Orchestrates the complete event processing pipeline with error handling
   * Validates events, manages user state, and coordinates specialized handlers
   * @param event - The flow event to process (FOLLOW, TEXT_MESSAGE, IMAGE_MESSAGE)
   * @returns Promise<void>
   * @throws {Error} Comprehensive error handling with user-friendly fallback messages
   * @example
   * await orchestrator.processEvent({
   *   type: "TEXT_MESSAGE",
   *   userId: "user123",
   *   replyToken: "token456",
   *   text: "/開始合成"
   * });
   */
  public async processEvent(event: FlowEvent): Promise<void> {
    try {
      // Validate event structure
      if (!this.eventRouter.validateEvent(event)) {
        throw new Error("Invalid event structure");
      }

      // Get current user state
      const currentState = await this.userStateService.getUserState(
        event.userId,
      );

      this.logger.log(
        `Processing ${event.type} for user ${event.userId} in state ${currentState}`,
        { color: "blue" },
      );

      // Route event to appropriate handlers
      await this.eventRouter.routeEvent(
        event,
        {
          handleFollow: this.handleFollow.bind(this),
          handleTextMessage: this.handleTextMessage.bind(this),
          handleImageMessage: this.handleImageMessage.bind(this),
        },
        currentState,
      );
    } catch (error) {
      this.logger.handleError(error as Error);
      const errorMessage = this.replyService.createErrorReply();
      await this.sendReply(event.replyToken, [errorMessage]);
    }
  }

  /**
   * Handle follow events (new user)
   * @private
   */
  private async handleFollow(
    event: FlowEvent & { type: "FOLLOW" },
  ): Promise<void> {
    await this.userStateService.setUserState(event.userId, USER_STATES.IDLE);
    const welcomeMessage = this.replyService.createWelcomeReply();
    await this.sendReply(event.replyToken, [welcomeMessage]);
  }

  /**
   * Handle text messages by delegating to TextMessageHandlerService
   * @private
   */
  private async handleTextMessage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
    currentState: string,
  ): Promise<void> {
    await this.textHandler.handleTextMessage(
      event,
      currentState as UserState,
      {
        startPassiveFlow: this.startPassiveFlow.bind(this),
        clearCharacterImage: this.clearCharacterImage.bind(this),
        clearClothingImage: this.clearClothingImage.bind(this),
        handleClearAllCommand: this.handleClearAllCommand.bind(this),
        handleDevInit: this.handleDevInit.bind(this),
        regenerateImage: this.regenerateImage.bind(this),
        checkSynthesisResult: this.checkSynthesisResult.bind(this),
      },
      this.sendReply.bind(this),
    );
  }

  /**
   * Handle image messages by delegating to ImageMessageHandlerService
   * @private
   */
  private async handleImageMessage(
    event: FlowEvent & { type: "IMAGE_MESSAGE" },
    currentState: string,
  ): Promise<void> {
    await this.imageHandler.handleImageMessage(
      event,
      currentState as UserState,
      {
        performBackgroundSynthesis: this.performBackgroundSynthesis.bind(this),
      },
      this.sendReply.bind(this),
    );
  }

  /**
   * Start passive flow - request character image
   * @private
   */
  private async startPassiveFlow(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
  ): Promise<void> {
    await this.userStateService.setUserState(
      event.userId,
      USER_STATES.PASSIVE_AWAITING_CHARACTER,
    );
    const message = this.replyService.createRequestCharacterReply();
    await this.sendReply(event.replyToken, [message]);
  }

  /**
   * Background synthesis process
   * Performs AI image synthesis with comprehensive error handling and state management
   * Uses locking mechanism to prevent concurrent synthesis operations for same user
   * @param userId - The user ID for synthesis operation
   * @param triggerType - Type of trigger ("character" or "clothing") for result state determination
   * @returns Promise<void>
   * @private
   */
  private async performBackgroundSynthesis(
    userId: string,
    triggerType: "character" | "clothing",
  ): Promise<void> {
    const lockResult = await this.userStateService.executeWithLock(
      userId,
      "synthesis",
      async () => {
        try {
          // Get both images
          const characterPath = await this.imageCacheService.getImagePath(
            userId,
            "character",
          );
          const clothingPath = await this.imageCacheService.getImagePath(
            userId,
            "clothing",
          );

          if (!characterPath || !clothingPath) {
            throw new Error("Missing required images for synthesis");
          }

          this.logger.log(`Starting synthesis for user ${userId}`, {
            color: "magenta",
          });

          // Perform AI synthesis
          const generatedImagePath =
            await this.aiService.synthesizeImages(userId);

          // Store synthesis result
          await this.userStateService.setSynthesisResult(userId, {
            status: "completed",
            imagePath: generatedImagePath,
            timestamp: Date.now(),
          });

          // Transition to result check state
          const targetState =
            triggerType === "character"
              ? USER_STATES.PASSIVE_AWAITING_RESULT_CHECK_CHARACTER
              : USER_STATES.PASSIVE_AWAITING_RESULT_CHECK_CLOTHING;

          await this.userStateService.transitionUserState(
            userId,
            USER_STATES.GENERATING_IMAGE,
            targetState,
          );

          this.logger.log(`Synthesis completed for user ${userId}`, {
            color: "green",
          });

          return { success: true };
        } catch (error) {
          this.logger.handleError(error as Error);

          // Store failure result
          await this.userStateService.setSynthesisResult(userId, {
            status: "failed",
            errorMessage: (error as Error).message,
            timestamp: Date.now(),
          });

          // Reset to idle state
          await this.userStateService.setUserState(userId, USER_STATES.IDLE);

          return { success: false, error: (error as Error).message };
        }
      },
    );

    if (!lockResult.success) {
      this.logger.log(`Synthesis failed to acquire lock for user ${userId}`, {
        color: "red",
      });
    }
  }

  /**
   * Check synthesis result
   * Retrieves and processes synthesis results from background operations
   * Handles success, failure, and in-progress states with appropriate user feedback
   * @param event - The text message event triggering result check
   * @returns Promise<void>
   * @private
   */
  private async checkSynthesisResult(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
  ): Promise<void> {
    const result = await this.userStateService.getSynthesisResult(event.userId);

    if (result?.status === "completed" && result.imagePath) {
      // Success - show result
      const imageUrl = await this.imageCacheService.getImageUrl(
        event.userId,
        "generated",
      );
      if (!imageUrl) {
        throw new Error("Generated image URL not available");
      }
      const completeMessage = this.replyService.createSynthesisCompleteReply();
      const imageMessage =
        this.replyService.createSynthesisResultImageReply(imageUrl);
      const optionsMessage =
        this.replyService.createPostSynthesisOptionsReply();
      await this.sendReply(event.replyToken, [
        completeMessage,
        imageMessage,
        optionsMessage,
      ]);

      // Reset to idle
      await this.userStateService.setUserState(event.userId, USER_STATES.IDLE);
      await this.userStateService.clearSynthesisResult(event.userId);
    } else if (result?.status === "failed") {
      // Failure - show error and options
      const failureMessage = this.replyService.createErrorReply(
        result.errorMessage || "合成失敗",
      );
      await this.sendReply(event.replyToken, [failureMessage]);

      // Reset to idle
      await this.userStateService.setUserState(event.userId, USER_STATES.IDLE);
      await this.userStateService.clearSynthesisResult(event.userId);
    } else {
      // Still processing
      const processingMessage = this.replyService.createProcessingReply();
      await this.sendReply(event.replyToken, [processingMessage]);
    }
  }

  /**
   * Clear character image
   * @private
   */
  private async clearCharacterImage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
  ): Promise<void> {
    await this.imageCacheService.clearCharacter(event.userId);
    const message = this.replyService.createCharacterClearedReply();
    await this.sendReply(event.replyToken, [message]);
  }

  /**
   * Clear clothing image
   * @private
   */
  private async clearClothingImage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
  ): Promise<void> {
    await this.imageCacheService.clearClothing(event.userId);
    const message = this.replyService.createClothingClearedReply();
    await this.sendReply(event.replyToken, [message]);
  }

  /**
   * Handle clear all command
   * @private
   */
  private async handleClearAllCommand(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
  ): Promise<void> {
    await this.imageCacheService.clearAll(event.userId);
    await this.userStateService.setUserState(event.userId, USER_STATES.IDLE);
    const message = this.replyService.createAllClearedReply();
    await this.sendReply(event.replyToken, [message]);
  }

  /**
   * Handle development init command
   * @private
   */
  private async handleDevInit(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
  ): Promise<void> {
    if (this.config.getConfig().NODE_ENV !== "production") {
      await this.userStateService.clearAllUserData(event.userId);
      await this.userStateService.setUserState(event.userId, USER_STATES.IDLE);
      const message = this.replyService.createWelcomeReply();
      await this.sendReply(event.replyToken, [message]);
    } else {
      const message =
        this.replyService.createErrorReply("開發命令在生產環境中不可用");
      await this.sendReply(event.replyToken, [message]);
    }
  }

  /**
   * Regenerate image
   * @private
   */
  private async regenerateImage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
  ): Promise<void> {
    const hasCharacter = await this.imageCacheService.hasCharacter(
      event.userId,
    );
    const hasClothing = await this.imageCacheService.hasClothing(event.userId);

    if (hasCharacter && hasClothing) {
      await this.userStateService.setUserState(
        event.userId,
        USER_STATES.GENERATING_IMAGE,
      );
      const processingMessage = this.replyService.createProcessingReply();
      await this.sendReply(event.replyToken, [processingMessage]);

      // Start background synthesis
      this.performBackgroundSynthesis(event.userId, "character").catch(
        (error) => {
          this.logger.handleError(error);
        },
      );
    } else {
      const errorMessage = this.replyService.createErrorReply(
        "請確保已上傳人物和衣物圖片後再重新合成",
      );
      await this.sendReply(event.replyToken, [errorMessage]);
    }
  }

  /**
   * Send reply messages using LINE provider
   * Provides centralized message sending with error handling and logging
   * Uses LINE Bot SDK messaging client for reliable message delivery
   * @param replyToken - The reply token from LINE webhook event
   * @param messages - Array of LINE messages to send back to user
   * @returns Promise<void>
   * @private
   */
  private async sendReply(
    replyToken: string,
    messages: messagingApi.Message[],
  ): Promise<void> {
    try {
      await this.lineProvider.getMessagingClient().replyMessage({
        replyToken,
        messages,
      });
    } catch (error) {
      this.logger.handleError(error as Error);
    }
  }
}

export default FlowOrchestratorService;
