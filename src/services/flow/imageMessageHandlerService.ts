import { messagingApi } from "@line/bot-sdk";

import ConsoleHandler from "../../utils/consoleHandler";
import { FlowEvent } from "../flowManagerService";
import ImageCacheService from "../imageCacheService";
import ReplyService from "../replyService";
import UserStateService, { USER_STATES, UserState } from "../userStateService";

/**
 * @class ImageMessageHandlerService
 * @description Handles all image message processing logic based on user state
 * Extracted from FlowManagerService to follow single responsibility principle
 */
class ImageMessageHandlerService {
  private static instance: ImageMessageHandlerService;
  private logger = ConsoleHandler.getInstance("ImageMessageHandlerService");
  private userStateService: UserStateService;
  private replyService: ReplyService;
  private imageCacheService: ImageCacheService;

  /**
   * Private constructor for the Singleton pattern.
   * Initializes service dependencies for image processing operations
   * @private
   */
  private constructor() {
    this.userStateService = UserStateService.getInstance();
    this.replyService = ReplyService.getInstance();
    this.imageCacheService = ImageCacheService.getInstance();
  }

  /**
   * Gets the singleton instance of the ImageMessageHandlerService.
   * Ensures single instance for consistent image processing state management
   * @returns {ImageMessageHandlerService} The singleton instance
   * @static
   */
  public static getInstance(): ImageMessageHandlerService {
    if (!ImageMessageHandlerService.instance) {
      ImageMessageHandlerService.instance = new ImageMessageHandlerService();
    }
    return ImageMessageHandlerService.instance;
  }

  /**
   * Handle image messages based on current user state
   * Implements state-based image processing with atomic operations and error handling
   * Supports character and clothing image uploads with automatic synthesis triggering
   * @param event - The image message event containing image data
   * @param currentState - The user's current state for context-aware processing
   * @param handlers - Object containing external handlers for background synthesis operations
   * @param sendReply - Function to send reply messages back to user
   * @returns Promise<void>
   * @throws {Error} Propagates image processing errors after logging
   * @example
   * await imageHandler.handleImageMessage(event, "awaiting_character", {
   *   performBackgroundSynthesis: async (userId, triggerType) => { ... }
   * }, sendReply);
   */
  public async handleImageMessage(
    event: FlowEvent & { type: "IMAGE_MESSAGE" },
    currentState: UserState,
    handlers: {
      performBackgroundSynthesis: (
        userId: string,
        triggerType: "character" | "clothing",
      ) => Promise<void>;
    },
    sendReply: (
      replyToken: string,
      messages: messagingApi.Message[],
    ) => Promise<void>,
  ): Promise<void> {
    this.logger.log(
      `Handling image upload for user ${event.userId} in state ${currentState}`,
      { color: "magenta" },
    );

    switch (currentState) {
      case USER_STATES.PASSIVE_AWAITING_CHARACTER:
        await this.handleCharacterImageUpload(event, handlers, sendReply);
        break;
      case USER_STATES.PASSIVE_AWAITING_CLOTHING:
        await this.handleClothingImageUpload(event, handlers, sendReply);
        break;
      case USER_STATES.IDLE:
        // Direct image upload without state setup - handle gracefully
        await this.handleDirectImageUpload(event, sendReply);
        break;
      default: {
        // Unexpected image upload
        const unexpectedMessage = this.replyService.createErrorReply(
          "目前無法處理圖片上傳，請先選擇對應操作",
        );
        await sendReply(event.replyToken, [unexpectedMessage]);
        this.logger.log(`Unexpected image upload in state ${currentState}`, {
          color: "yellow",
        });
        break;
      }
    }
  }

  /**
   * Handle character image upload
   * Processes character image with atomic state transitions and synthesis coordination
   * Uses locking mechanism to prevent race conditions during concurrent uploads
   * @param event - The image message event containing character image
   * @param handlers - External handlers for background synthesis
   * @param sendReply - Function to send reply messages
   * @returns Promise<void>
   * @private
   */
  private async handleCharacterImageUpload(
    event: FlowEvent & { type: "IMAGE_MESSAGE" },
    handlers: {
      performBackgroundSynthesis: (
        userId: string,
        triggerType: "character" | "clothing",
      ) => Promise<void>;
    },
    sendReply: (
      replyToken: string,
      messages: messagingApi.Message[],
    ) => Promise<void>,
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
        await sendReply(event.replyToken, [processingMessage]);

        // Start background synthesis
        handlers
          .performBackgroundSynthesis(event.userId, "character")
          .catch((error) => {
            this.logger.handleError(error);
          });
      } else {
        // Request clothing image
        const message = this.replyService.createRequestClothingReply();
        await sendReply(event.replyToken, [message]);
      }
    } else {
      const errorMessage =
        this.replyService.createErrorReply("圖片處理失敗，請重新上傳");
      await sendReply(event.replyToken, [errorMessage]);
    }
  }

  /**
   * Handle clothing image upload
   * @private
   */
  private async handleClothingImageUpload(
    event: FlowEvent & { type: "IMAGE_MESSAGE" },
    handlers: {
      performBackgroundSynthesis: (
        userId: string,
        triggerType: "character" | "clothing",
      ) => Promise<void>;
    },
    sendReply: (
      replyToken: string,
      messages: messagingApi.Message[],
    ) => Promise<void>,
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
          // This shouldn't happen in normal flow, but handle gracefully
          this.logger.log(
            "Clothing uploaded without character - unexpected state",
            { color: "yellow" },
          );
          return { transitioned: false, hasCharacter: false };
        }
      },
    );

    if (lockResult.success && lockResult.data?.transitioned) {
      if (lockResult.data.hasCharacter) {
        // Start synthesis immediately
        const processingMessage = this.replyService.createProcessingReply();
        await sendReply(event.replyToken, [processingMessage]);

        // Start background synthesis
        handlers
          .performBackgroundSynthesis(event.userId, "clothing")
          .catch((error) => {
            this.logger.handleError(error);
          });
      } else {
        const errorMessage =
          this.replyService.createErrorReply("請先上傳人物圖片");
        await sendReply(event.replyToken, [errorMessage]);
      }
    } else {
      const errorMessage =
        this.replyService.createErrorReply("圖片處理失敗，請重新上傳");
      await sendReply(event.replyToken, [errorMessage]);
    }
  }

  /**
   * Handle direct image upload without proper state setup
   * @private
   */
  private async handleDirectImageUpload(
    event: FlowEvent & { type: "IMAGE_MESSAGE" },
    sendReply: (
      replyToken: string,
      messages: messagingApi.Message[],
    ) => Promise<void>,
  ): Promise<void> {
    this.logger.log(
      "Direct image upload detected - guiding user to proper flow",
      { color: "cyan" },
    );

    // Guide user to proper flow
    const guideMessage = this.replyService.createWelcomeReply();
    await sendReply(event.replyToken, [guideMessage]);
  }
}

export default ImageMessageHandlerService;
