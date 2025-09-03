import { messagingApi } from "@line/bot-sdk";

import LineProvider from "../providers/line";
import ConsoleHandler from "../utils/consoleHandler";
import AIService from "./aiService";
import CommandParserService, {
  ParsedCommand,
  PassiveCommand,
} from "./commandParserService";
import ConfigService from "./configService";
import ImageCacheService from "./imageCacheService";
import ReplyService from "./replyService";
import UserStateService, { USER_STATES, UserState } from "./userStateService";

/**
 * Event types that the flow manager can process
 */
export type FlowEvent =
  | { type: "TEXT_MESSAGE"; text: string; userId: string; replyToken: string }
  | {
      type: "IMAGE_MESSAGE";
      imageId: string;
      userId: string;
      replyToken: string;
    }
  | { type: "FOLLOW"; userId: string; replyToken: string };

/**
 * @class FlowManagerService
 * @description Core state machine for managing user flows
 */
class FlowManagerService {
  private static instance: FlowManagerService;
  private logger = ConsoleHandler.getInstance("FlowManagerService");
  private userStateService: UserStateService;
  private commandParserService: CommandParserService;
  private replyService: ReplyService;
  private imageCacheService: ImageCacheService;
  private aiService: AIService;
  private lineProvider: LineProvider;
  private config: ConfigService;

  private constructor() {
    this.userStateService = UserStateService.getInstance();
    this.commandParserService = CommandParserService.getInstance();
    this.replyService = ReplyService.getInstance();
    this.imageCacheService = ImageCacheService.getInstance();
    this.aiService = AIService.getInstance();
    this.lineProvider = LineProvider.getInstance();
    this.config = ConfigService.getInstance();
  }

  public static getInstance(): FlowManagerService {
    if (!FlowManagerService.instance) {
      FlowManagerService.instance = new FlowManagerService();
    }
    return FlowManagerService.instance;
  }

  /**
   * Process incoming webhook events
   */
  public async processEvent(event: FlowEvent): Promise<void> {
    try {
      const currentState = await this.userStateService.getUserState(
        event.userId,
      );
      this.logger.log(
        `Processing ${event.type} for user ${event.userId} in state ${currentState}`,
        { color: "blue" },
      );

      switch (event.type) {
        case "FOLLOW":
          await this.handleFollow(event);
          break;
        case "TEXT_MESSAGE":
          await this.handleTextMessage(event, currentState);
          break;
        case "IMAGE_MESSAGE":
          await this.handleImageMessage(event, currentState);
          break;
      }
    } catch (error) {
      this.logger.handleError(error as Error);
      const errorMessage = this.replyService.createErrorReply();
      await this.sendReply(event.replyToken, [errorMessage]);
    }
  }

  /**
   * Handle follow events (new user)
   */
  private async handleFollow(
    event: FlowEvent & { type: "FOLLOW" },
  ): Promise<void> {
    await this.userStateService.setUserState(event.userId, USER_STATES.IDLE);
    const welcomeMessage = this.replyService.createWelcomeReply();
    await this.sendReply(event.replyToken, [welcomeMessage]);
  }

  /**
   * Handle text messages based on current state
   */
  private async handleTextMessage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
    currentState: UserState,
  ): Promise<void> {
    const command = this.commandParserService.parseCommand(event.text);

    switch (currentState) {
      case USER_STATES.IDLE:
        await this.handleIdleTextMessage(event, command);
        break;
      case USER_STATES.PASSIVE_AWAITING_CHARACTER:
        await this.handleAwaitingCharacterTextMessage(event, command);
        break;
      case USER_STATES.PASSIVE_AWAITING_CLOTHING:
        await this.handleAwaitingClothingTextMessage(event, command);
        break;
      case USER_STATES.GENERATING_IMAGE:
        await this.handleGeneratingImageTextMessage(event, command);
        break;
      case USER_STATES.PASSIVE_AWAITING_RESULT_CHECK_CHARACTER:
        await this.handleAwaitingResultCharacterTextMessage(event, command);
        break;
      case USER_STATES.PASSIVE_AWAITING_RESULT_CHECK_CLOTHING:
        await this.handleAwaitingResultClothingTextMessage(event, command);
        break;
      default:
        await this.handleUnknownState(event);
    }
  }

  /**
   * Handle image messages based on current state
   */
  private async handleImageMessage(
    event: FlowEvent & { type: "IMAGE_MESSAGE" },
    currentState: UserState,
  ): Promise<void> {
    switch (currentState) {
      case USER_STATES.PASSIVE_AWAITING_CHARACTER:
        await this.handleCharacterImageUpload(event);
        break;
      case USER_STATES.PASSIVE_AWAITING_CLOTHING:
        await this.handleClothingImageUpload(event);
        break;
      case USER_STATES.IDLE: {
        // For Phase 2: Active flow will be implemented here
        const errorMessage =
          this.replyService.createErrorReply("請先點擊「開始使用」開始流程");
        await this.sendReply(event.replyToken, [errorMessage]);
        break;
      }
      default: {
        const wrongStateMessage =
          this.replyService.createErrorReply(
            "現在無法接收圖片，請先完成當前操作",
          );
        await this.sendReply(event.replyToken, [wrongStateMessage]);
      }
    }
  }

  /**
   * Handle text messages in IDLE state
   */
  private async handleIdleTextMessage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
    command: ParsedCommand,
  ): Promise<void> {
    switch (command.type) {
      case PassiveCommand.START_FLOW:
        await this.startPassiveFlow(event);
        break;
      case PassiveCommand.CLEAR_CHARACTER:
        await this.clearCharacterImage(event);
        break;
      case PassiveCommand.CLEAR_CLOTHING:
        await this.clearClothingImage(event);
        break;
      case PassiveCommand.CLEAR_ALL:
        await this.handleClearAllCommand(event);
        break;
      case PassiveCommand.DEV_INIT:
        await this.handleDevInit(event);
        break;
      case PassiveCommand.REGENERATE:
        await this.regenerateImage(event);
        break;
      case PassiveCommand.REUPLOAD_CHARACTER: {
        await this.userStateService.setUserState(
          event.userId,
          USER_STATES.PASSIVE_AWAITING_CHARACTER,
        );
        const characterMessage =
          this.replyService.createRequestReUploadCharacterReply();
        await this.sendReply(event.replyToken, [characterMessage]);
        break;
      }
      case PassiveCommand.REUPLOAD_CLOTHING: {
        await this.userStateService.setUserState(
          event.userId,
          USER_STATES.PASSIVE_AWAITING_CLOTHING,
        );
        const clothingMessage =
          this.replyService.createRequestReUploadClothingReply();
        await this.sendReply(event.replyToken, [clothingMessage]);
        break;
      }
      default: {
        // Return to welcome state
        const welcomeMessage = this.replyService.createWelcomeReply();
        await this.sendReply(event.replyToken, [welcomeMessage]);
      }
    }
  }

  /**
   * Handle text messages while awaiting character image
   */
  private async handleAwaitingCharacterTextMessage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
    command: ParsedCommand,
  ): Promise<void> {
    switch (command.type) {
      case PassiveCommand.CLEAR_ALL:
        await this.handleClearAllCommand(event);
        break;
      default: {
        // Remind user what we're expecting
        const requestMessage = this.replyService.createRequestCharacterReply();
        await this.sendReply(event.replyToken, [requestMessage]);
      }
    }
  }

  /**
   * Handle text messages while awaiting clothing image
   */
  private async handleAwaitingClothingTextMessage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
    command: ParsedCommand,
  ): Promise<void> {
    switch (command.type) {
      case PassiveCommand.CLEAR_CHARACTER:
        await this.clearCharacterImage(event);
        await this.startPassiveFlow(event);
        break;
      case PassiveCommand.CLEAR_ALL:
        await this.handleClearAllCommand(event);
        break;
      default: {
        // Remind user what we're expecting
        const requestMessage = this.replyService.createRequestClothingReply();
        await this.sendReply(event.replyToken, [requestMessage]);
      }
    }
  }

  /**
   * Handle text messages during image generation
   */
  private async handleGeneratingImageTextMessage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
    command: ParsedCommand,
  ): Promise<void> {
    if (command.type === PassiveCommand.CHECK_RESULT) {
      await this.checkSynthesisResult(event);
    } else {
      // Remind user that synthesis is in progress
      const processingMessage = this.replyService.createProcessingReply();
      await this.sendReply(event.replyToken, [processingMessage]);
    }
  }

  /**
   * Handle text messages while awaiting result check (CHARACTER)
   */
  private async handleAwaitingResultCharacterTextMessage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
    command: ParsedCommand,
  ): Promise<void> {
    switch (command.type) {
      case PassiveCommand.CHECK_RESULT:
        await this.checkSynthesisResult(event);
        break;
      case PassiveCommand.REGENERATE:
        await this.regenerateImage(event);
        break;
      case PassiveCommand.REUPLOAD_CHARACTER: {
        await this.imageCacheService.clearCharacter(event.userId);
        await this.userStateService.setUserState(
          event.userId,
          USER_STATES.PASSIVE_AWAITING_CHARACTER,
        );
        const characterMessage =
          this.replyService.createRequestReUploadCharacterReply();
        await this.sendReply(event.replyToken, [characterMessage]);
        break;
      }
      case PassiveCommand.REUPLOAD_CLOTHING: {
        await this.imageCacheService.clearClothing(event.userId);
        await this.userStateService.setUserState(
          event.userId,
          USER_STATES.PASSIVE_AWAITING_CLOTHING,
        );
        const clothingMessage =
          this.replyService.createRequestReUploadClothingReply();
        await this.sendReply(event.replyToken, [clothingMessage]);
        break;
      }
      case PassiveCommand.CLEAR_ALL:
        await this.handleClearAllCommand(event);
        break;
      default: {
        const resultMessage = this.replyService.createStillProcessingReply();
        await this.sendReply(event.replyToken, [resultMessage]);
      }
    }
  }

  /**
   * Handle text messages while awaiting result check (CLOTHING)
   */
  private async handleAwaitingResultClothingTextMessage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
    command: ParsedCommand,
  ): Promise<void> {
    switch (command.type) {
      case PassiveCommand.CHECK_RESULT:
        await this.checkSynthesisResult(event);
        break;
      case PassiveCommand.REGENERATE:
        await this.regenerateImage(event);
        break;
      case PassiveCommand.REUPLOAD_CHARACTER: {
        await this.imageCacheService.clearCharacter(event.userId);
        await this.userStateService.setUserState(
          event.userId,
          USER_STATES.PASSIVE_AWAITING_CHARACTER,
        );
        const characterMessage =
          this.replyService.createRequestReUploadCharacterReply();
        await this.sendReply(event.replyToken, [characterMessage]);
        break;
      }
      case PassiveCommand.REUPLOAD_CLOTHING: {
        await this.imageCacheService.clearClothing(event.userId);
        await this.userStateService.setUserState(
          event.userId,
          USER_STATES.PASSIVE_AWAITING_CLOTHING,
        );
        const clothingMessage =
          this.replyService.createRequestReUploadClothingReply();
        await this.sendReply(event.replyToken, [clothingMessage]);
        break;
      }
      case PassiveCommand.CLEAR_ALL:
        await this.handleClearAllCommand(event);
        break;
      default: {
        const resultMessage = this.replyService.createStillProcessingReply();
        await this.sendReply(event.replyToken, [resultMessage]);
      }
    }
  }

  /**
   * Start the passive flow
   */
  private async startPassiveFlow(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
  ): Promise<void> {
    const transitioned = await this.userStateService.transitionUserState(
      event.userId,
      USER_STATES.IDLE,
      USER_STATES.PASSIVE_AWAITING_CHARACTER,
    );

    if (transitioned) {
      const message = this.replyService.createRequestCharacterReply();
      await this.sendReply(event.replyToken, [message]);
    } else {
      const errorMessage =
        this.replyService.createErrorReply("無法開始流程，請稍後再試");
      await this.sendReply(event.replyToken, [errorMessage]);
    }
  }

  /**
   * Handle character image upload
   */
  private async handleCharacterImageUpload(
    event: FlowEvent & { type: "IMAGE_MESSAGE" },
  ): Promise<void> {
    const lockResult = await this.userStateService.executeWithLock(
      event.userId,
      "character_upload",
      async () => {
        // Save the character image
        await this.imageCacheService.saveImage(
          event.userId,
          event.imageId,
          "character",
        );

        // Check if clothing already exists
        const hasClothing = await this.imageCacheService.hasClothing(
          event.userId,
        );

        if (hasClothing) {
          // Both images available, transition to generating
          const transitioned = await this.userStateService.transitionUserState(
            event.userId,
            USER_STATES.PASSIVE_AWAITING_CHARACTER,
            USER_STATES.GENERATING_IMAGE,
          );
          return { transitioned, hasClothing: true };
        } else {
          // Transition to awaiting clothing
          const transitioned = await this.userStateService.transitionUserState(
            event.userId,
            USER_STATES.PASSIVE_AWAITING_CHARACTER,
            USER_STATES.PASSIVE_AWAITING_CLOTHING,
          );
          return { transitioned, hasClothing: false };
        }
      },
    );

    if (lockResult.success && lockResult.data?.transitioned) {
      if (lockResult.data.hasClothing) {
        // Start synthesis immediately
        const processingMessage = this.replyService.createProcessingReply();
        await this.sendReply(event.replyToken, [processingMessage]);

        // Start background synthesis
        this.performBackgroundSynthesis(event.userId, "character").catch(
          (error) => {
            this.logger.handleError(error);
          },
        );
      } else {
        // Request clothing image
        const message = this.replyService.createRequestClothingReply();
        await this.sendReply(event.replyToken, [message]);
      }
    } else {
      const errorMessage =
        this.replyService.createErrorReply("圖片處理失敗，請重新上傳");
      await this.sendReply(event.replyToken, [errorMessage]);
    }
  }

  /**
   * Handle clothing image upload
   */
  private async handleClothingImageUpload(
    event: FlowEvent & { type: "IMAGE_MESSAGE" },
  ): Promise<void> {
    const lockResult = await this.userStateService.executeWithLock(
      event.userId,
      "clothing_upload",
      async () => {
        // Save the clothing image
        await this.imageCacheService.saveImage(
          event.userId,
          event.imageId,
          "clothing",
        );

        // Check if character already exists
        const hasCharacter = await this.imageCacheService.hasCharacter(
          event.userId,
        );

        if (hasCharacter) {
          // Both images available, transition to generating
          const transitioned = await this.userStateService.transitionUserState(
            event.userId,
            USER_STATES.PASSIVE_AWAITING_CLOTHING,
            USER_STATES.GENERATING_IMAGE,
          );
          return { transitioned, hasCharacter: true };
        } else {
          // Transition to awaiting character
          const transitioned = await this.userStateService.transitionUserState(
            event.userId,
            USER_STATES.PASSIVE_AWAITING_CLOTHING,
            USER_STATES.PASSIVE_AWAITING_CHARACTER,
          );
          return { transitioned, hasCharacter: false };
        }
      },
    );

    if (lockResult.success && lockResult.data?.transitioned) {
      if (lockResult.data.hasCharacter) {
        // Start synthesis immediately
        const processingMessage = this.replyService.createProcessingReply();
        await this.sendReply(event.replyToken, [processingMessage]);

        // Start background synthesis
        this.performBackgroundSynthesis(event.userId, "clothing").catch(
          (error) => {
            this.logger.handleError(error);
          },
        );
      } else {
        // Request character image
        const message = this.replyService.createRequestCharacterReply();
        await this.sendReply(event.replyToken, [message]);
      }
    } else {
      const errorMessage =
        this.replyService.createErrorReply("圖片處理失敗，請重新上傳");
      await this.sendReply(event.replyToken, [errorMessage]);
    }
  }

  /**
   * Perform background image synthesis
   */
  private async performBackgroundSynthesis(
    userId: string,
    lastUploadedType: "character" | "clothing",
  ): Promise<void> {
    const result = await this.userStateService.executeWithLock(
      userId,
      "synthesis",
      async () => {
        this.logger.log(`Starting synthesis for user ${userId}`, {
          color: "blue",
        });

        // Set synthesis status
        await this.userStateService.setSynthesisResult(userId, {
          status: "processing",
          timestamp: Date.now(),
        });

        try {
          // Perform AI synthesis
          const generatedImagePath =
            await this.aiService.synthesizeImages(userId);

          // Save result
          await this.userStateService.setSynthesisResult(userId, {
            status: "completed",
            imagePath: generatedImagePath,
            timestamp: Date.now(),
          });

          // Transition to result check state based on last uploaded image type
          const targetState =
            lastUploadedType === "character"
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
        } catch (error) {
          this.logger.handleError(error as Error);

          // Save error result
          await this.userStateService.setSynthesisResult(userId, {
            status: "failed",
            errorMessage: (error as Error).message,
            timestamp: Date.now(),
          });

          // Transition to result check state based on last uploaded image type
          const targetState =
            lastUploadedType === "character"
              ? USER_STATES.PASSIVE_AWAITING_RESULT_CHECK_CHARACTER
              : USER_STATES.PASSIVE_AWAITING_RESULT_CHECK_CLOTHING;
          await this.userStateService.transitionUserState(
            userId,
            USER_STATES.GENERATING_IMAGE,
            targetState,
          );
        }
      },
    );

    if (!result.success) {
      this.logger.log(
        `Synthesis lock failed for user ${userId}: ${result.error}`,
        {
          color: "yellow",
        },
      );
    }
  }

  /**
   * Check synthesis result
   */
  private async checkSynthesisResult(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
  ): Promise<void> {
    const currentState = await this.userStateService.getUserState(event.userId);
    const synthesisResult = await this.userStateService.getSynthesisResult(
      event.userId,
    );

    if (currentState === USER_STATES.GENERATING_IMAGE) {
      // Still processing
      const stillProcessingMessage =
        this.replyService.createStillProcessingReply();
      await this.sendReply(event.replyToken, [stillProcessingMessage]);
    } else if (
      synthesisResult?.status === "completed" &&
      synthesisResult.imagePath
    ) {
      // Success - send result
      const completedMessage = this.replyService.createSynthesisCompleteReply();
      const resultImageMessage =
        this.replyService.createSynthesisResultImageReply(
          this.convertPathToUrl(synthesisResult.imagePath),
        );
      const optionsMessage =
        this.replyService.createPostSynthesisOptionsReply();

      await this.sendReply(event.replyToken, [
        completedMessage,
        resultImageMessage,
        optionsMessage,
      ]);

      // Clear result and transition to idle
      await this.userStateService.clearSynthesisResult(event.userId);
      await this.userStateService.setUserState(event.userId, USER_STATES.IDLE);
    } else if (synthesisResult?.status === "failed") {
      // Failed - offer options
      const errorMessage =
        this.replyService.createErrorReply("圖片合成失敗，請重新嘗試");
      await this.sendReply(event.replyToken, [errorMessage]);

      // Clear result and restart flow
      await this.userStateService.clearSynthesisResult(event.userId);
      await this.userStateService.setUserState(event.userId, USER_STATES.IDLE);
    } else {
      // No active synthesis
      const noActiveMessage =
        this.replyService.createErrorReply("沒有進行中的合成作業");
      await this.sendReply(event.replyToken, [noActiveMessage]);
    }
  }

  /**
   * Regenerate image (restart synthesis with existing images)
   */
  private async regenerateImage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
  ): Promise<void> {
    const hasBothImages = await this.imageCacheService.hasBothImages(
      event.userId,
    );

    if (!hasBothImages) {
      const errorMessage =
        this.replyService.createErrorReply("請先上傳人物和衣物圖片");
      await this.sendReply(event.replyToken, [errorMessage]);
      await this.startPassiveFlow(event);
      return;
    }

    const currentState = await this.userStateService.getUserState(event.userId);
    if (
      currentState !== USER_STATES.IDLE &&
      currentState !== USER_STATES.PASSIVE_AWAITING_RESULT_CHECK_CHARACTER &&
      currentState !== USER_STATES.PASSIVE_AWAITING_RESULT_CHECK_CLOTHING
    ) {
      const errorMessage =
        this.replyService.createErrorReply("目前無法重新生成");
      await this.sendReply(event.replyToken, [errorMessage]);
      return;
    }

    // Determine last uploaded type from current state
    const lastUploadedType =
      currentState === USER_STATES.PASSIVE_AWAITING_RESULT_CHECK_CHARACTER
        ? "character"
        : "clothing";

    // Set state directly to GENERATING_IMAGE
    await this.userStateService.setUserState(
      event.userId,
      USER_STATES.GENERATING_IMAGE,
    );

    const processingMessage = this.replyService.createProcessingReply();
    await this.sendReply(event.replyToken, [processingMessage]);

    // Start background synthesis
    this.performBackgroundSynthesis(event.userId, lastUploadedType).catch(
      (error) => {
        this.logger.handleError(error);
      },
    );
  }

  /**
   * Clear character image
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
   */
  private async clearClothingImage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
  ): Promise<void> {
    await this.imageCacheService.clearClothing(event.userId);
    const message = this.replyService.createClothingClearedReply();
    await this.sendReply(event.replyToken, [message]);
  }

  /**
   * Clear all images and return to welcome state
   */
  private async handleClearAllCommand(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
  ): Promise<void> {
    await this.imageCacheService.clearAll(event.userId);
    await this.userStateService.clearAllUserData(event.userId);
    await this.userStateService.setUserState(
      event.userId,
      USER_STATES.PASSIVE_AWAITING_CHARACTER,
    );

    // Send clear message followed by upload request message
    const clearMessage = this.replyService.createCharacterClearedReply();
    const requestMessage = this.replyService.createRequestCharacterReply();
    await this.sendReply(event.replyToken, [clearMessage, requestMessage]);
  }

  /**
   * Handle development init command
   */
  private async handleDevInit(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
  ): Promise<void> {
    // Only allow in development environment
    if (process.env.NODE_ENV === "production") {
      const errorMessage =
        this.replyService.createErrorReply("此命令僅供開發使用");
      await this.sendReply(event.replyToken, [errorMessage]);
      return;
    }

    // Execute dev init with lock to prevent race conditions
    const lockResult = await this.userStateService.executeWithLock(
      event.userId,
      "dev_init",
      async () => {
        // Clear all user data and images, excluding current lock
        await this.imageCacheService.clearAll(event.userId);
        await this.userStateService.clearAllUserData(event.userId, [
          "lock:dev_init",
        ]);

        // Reset to initial state
        await this.userStateService.setUserState(
          event.userId,
          USER_STATES.IDLE,
        );

        return { success: true };
      },
    );

    if (lockResult.success) {
      // Send welcome message
      const welcomeMessage = this.replyService.createWelcomeReply();
      await this.sendReply(event.replyToken, [welcomeMessage]);

      this.logger.log(`Development init executed for user ${event.userId}`, {
        color: "blue",
      });
    } else {
      const errorMessage =
        this.replyService.createErrorReply("系統忙碌中，請稍後再試");
      await this.sendReply(event.replyToken, [errorMessage]);

      this.logger.log(
        `Dev init lock failed for user ${event.userId}: ${lockResult.error}`,
        { color: "yellow" },
      );
    }
  }

  /**
   * Handle unknown state
   */
  private async handleUnknownState(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
  ): Promise<void> {
    this.logger.log(`Unknown state for user ${event.userId}`, { color: "red" });
    await this.userStateService.setUserState(event.userId, USER_STATES.IDLE);
    const welcomeMessage = this.replyService.createWelcomeReply();
    await this.sendReply(event.replyToken, [welcomeMessage]);
  }

  /**
   * Convert file path to public URL
   */
  private convertPathToUrl(filePath: string): string {
    const baseUrl = this.config.getConfig().BASE_URL || "http://localhost:8000";
    const relativePath = filePath.replace(process.cwd() + "/images", "");
    const timestamp = Date.now();
    return `${baseUrl}/images${relativePath}?t=${timestamp}`;
  }

  /**
   * Send reply message via LINE API
   */
  private async sendReply(
    replyToken: string,
    messages: messagingApi.Message[],
  ): Promise<void> {
    const client = this.lineProvider.getMessagingClient();
    await client.replyMessage({
      replyToken,
      messages,
    });
  }
}

export default FlowManagerService;
