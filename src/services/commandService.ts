import { messagingApi } from "@line/bot-sdk";
import * as path from "path";

import GeminiProvider from "../providers/gemini";
import LineProvider from "../providers/line";
import ConsoleHandler from "../utils/consoleHandler";
import ConfigService from "./configService";
import ImageCacheService from "./imageCacheService";
import ReplyService from "./replyService";
import UserStateService, {
  PendingImage,
  USER_STATES,
  UserState,
} from "./userStateService";

// Defines the function signature for a command handler.
type CommandHandler = (userId: string, replyToken: string) => Promise<void>;

/**
 * @class CommandService
 * @description Handles the business logic for all user commands.
 */
class CommandService {
  private static instance: CommandService;
  private lineProvider: LineProvider;
  private imageCacheService: ImageCacheService;
  private replyService: ReplyService;
  private config: ConfigService;
  private userStateService: UserStateService;
  private logger = ConsoleHandler.getInstance("CommandService");
  private commandHandlers: Map<string, CommandHandler> = new Map();

  /**
   * Private constructor for the Singleton pattern.
   */
  private constructor() {
    this.lineProvider = LineProvider.getInstance();
    this.imageCacheService = ImageCacheService.getInstance();
    this.replyService = ReplyService.getInstance();
    this.config = ConfigService.getInstance();
    this.userStateService = UserStateService.getInstance();

    this.initializeCommandHandlers();
  }

  /**
   * Gets the singleton instance of the CommandService.
   * @returns {CommandService} The singleton instance.
   */
  public static getInstance(): CommandService {
    if (!CommandService.instance) {
      CommandService.instance = new CommandService();
    }
    return CommandService.instance;
  }

  /**
   * Initializes the map of command strings to their handler functions.
   * @private
   */
  private initializeCommandHandlers(): void {
    this.commandHandlers = new Map([
      ["/上傳人物圖片", this.handleUploadCharacter.bind(this)],
      ["/上傳衣物圖片", this.handleUploadClothing.bind(this)],
      ["/清除人物圖片", this.handleClearCharacter.bind(this)],
      ["/清除衣物圖片", this.handleClearClothing.bind(this)],
      ["/全部清除", this.handleClearAll.bind(this)],
      ["/合成圖片", this.handleSynthesizeImages.bind(this)],
      ["/開始合成", this.handleSynthesizeImages.bind(this)],
      ["/查看結果", this.handleCheckSynthesisResult.bind(this)],
      ["/使用方式", this.handleHelp.bind(this)],
      ["/瀏覽現有圖片", this.handleBrowseImages.bind(this)],
      ["/更多選項", this.handleMoreOptions.bind(this)],
      ["/下載圖片", this.handleDownloadImage.bind(this)],
      ["人物圖片", this.handleCharacterImageType.bind(this)],
      ["衣物圖片", this.handleClothingImageType.bind(this)],
      ["更新衣物圖片", this.handleUpdateClothing.bind(this)],
      ["更新人物圖片", this.handleUpdateCharacter.bind(this)],
      ["直接合成", this.handleDirectSynthesize.bind(this)],
      // Development only command
      ["/init", this.handleInit.bind(this)],
    ]);
  }

  /**
   * Routes incoming text commands to the appropriate handler.
   * @param {string} userId - The ID of the user.
   * @param {string} text - The command text sent by the user.
   * @param {string} replyToken - The reply token for the event.
   */
  /**
   * Delegates state management to UserStateService.
   * @param {string} userId - The user's ID.
   * @param {UserState} state - The state to set.
   */
  public async setUserState(userId: string, state: UserState): Promise<void> {
    return this.userStateService.setUserState(userId, state);
  }

  /**
   * Delegates state retrieval to UserStateService.
   * @param {string} userId - The user's ID.
   * @returns {Promise<UserState>} The user's state.
   */
  public async getUserState(userId: string): Promise<UserState> {
    return this.userStateService.getUserState(userId);
  }

  /**
   * Delegates state clearing to UserStateService.
   * @param {string} userId - The user's ID.
   */
  public async clearUserState(userId: string): Promise<void> {
    return this.userStateService.clearUserState(userId);
  }

  /**
   * Delegates pending image management to UserStateService.
   * @param {string} userId - The ID of the user.
   * @param {string} imageId - The ID of the uploaded image.
   */
  public async setPendingImage(userId: string, imageId: string): Promise<void> {
    await this.userStateService.setPendingImage(userId, imageId);
    await this.userStateService.setUserState(
      userId,
      USER_STATES.WAITING_FOR_IMAGE_TYPE,
    );
  }

  /**
   * Delegates pending image retrieval to UserStateService.
   * @param {string} userId - The ID of the user.
   * @returns {Promise<PendingImage | null>} The pending image or null.
   */
  public async getPendingImage(userId: string): Promise<PendingImage | null> {
    return this.userStateService.getPendingImage(userId);
  }

  /**
   * Delegates pending image clearing to UserStateService.
   * @param {string} userId - The ID of the user.
   */
  public async clearPendingImage(userId: string): Promise<void> {
    return this.userStateService.clearPendingImage(userId);
  }

  /**
   * Handles incoming image messages based on the current user state.
   * @param {string} userId - The user's ID.
   * @param {string} imageId - The image message ID.
   * @param {string} replyToken - The reply token.
   */
  public async handleImageMessage(
    userId: string,
    imageId: string,
    replyToken: string,
  ): Promise<void> {
    const userState = await this.userStateService.getUserState(userId);

    this.logger.log(`Image message from ${userId}, state: ${userState}`, {
      color: "cyan",
    });

    if (userState === USER_STATES.WAITING_FOR_CHARACTER) {
      // Passive flow: user was prompted to upload a character image.
      try {
        const hadClothingBefore =
          await this.imageCacheService.hasClothing(userId);
        await this.imageCacheService.saveImage(userId, imageId, "character");
        await this.setUserState(userId, USER_STATES.IDLE);

        const confirmMessage =
          this.replyService.createImageReceivedMessage("character");
        await this.sendReply(replyToken, [confirmMessage]);

        const hasBothImages =
          await this.imageCacheService.hasBothImages(userId);
        if (!hadClothingBefore && hasBothImages) {
          await this.handleCommand(userId, "/開始合成", "");
        }
      } catch (error) {
        this.logger.handleError(error as Error);
        const errorMessage = this.replyService.createErrorMessage(
          "Failed to save image. Please try again.",
        );
        await this.sendReply(replyToken, [errorMessage]);
      }
    } else if (userState === USER_STATES.WAITING_FOR_CLOTHING) {
      // Passive flow: user was prompted to upload a clothing image.
      try {
        await this.imageCacheService.saveImage(userId, imageId, "clothing");
        await this.setUserState(userId, USER_STATES.IDLE);

        const confirmMessage =
          this.replyService.createImageReceivedMessage("clothing");
        await this.sendReply(replyToken, [confirmMessage]);

        const hasBothImages =
          await this.imageCacheService.hasBothImages(userId);
        if (hasBothImages) {
          await this.handleCommand(userId, "/開始合成", "");
        }
      } catch (error) {
        this.logger.handleError(error as Error);
        const errorMessage = this.replyService.createErrorMessage(
          "Failed to save image. Please try again.",
        );
        await this.sendReply(replyToken, [errorMessage]);
      }
    } else {
      // Active flow: user sends an image unprompted.
      try {
        await this.setPendingImage(userId, imageId);

        const inquiryMessage =
          this.replyService.createImageTypeInquiryMessage();
        await this.sendReply(replyToken, [inquiryMessage]);
      } catch (error) {
        this.logger.handleError(error as Error);
        const errorMessage = this.replyService.createErrorMessage(
          "An error occurred while processing the image. Please try again.",
        );
        await this.sendReply(replyToken, [errorMessage]);
      }
    }
  }

  public async handleCommand(
    userId: string,
    text: string,
    replyToken: string,
  ): Promise<void> {
    const handler = this.commandHandlers.get(text);

    if (handler) {
      await handler(userId, replyToken);
    } else {
      await this.handleDefault(userId, text, replyToken);
    }
  }

  /**
   * Sets the user's state to wait for a character image and prompts for upload.
   * @private
   */
  private async handleUploadCharacter(
    userId: string,
    replyToken: string,
  ): Promise<void> {
    await this.setUserState(userId, USER_STATES.WAITING_FOR_CHARACTER);
    const replyMessage = this.replyService.createWaitingForCharacterMessage();
    await this.sendReply(replyToken, [replyMessage]);
  }

  /**
   * Sets the user's state to wait for a clothing image and prompts for upload.
   * @private
   */
  private async handleUploadClothing(
    userId: string,
    replyToken: string,
  ): Promise<void> {
    await this.setUserState(userId, USER_STATES.WAITING_FOR_CLOTHING);
    const replyMessage = this.replyService.createWaitingForClothingMessage();
    await this.sendReply(replyToken, [replyMessage]);
  }

  /**
   * Clears the user's character image and sends a confirmation message.
   * @private
   */
  private async handleClearCharacter(
    userId: string,
    replyToken: string,
  ): Promise<void> {
    await this.imageCacheService.clearCharacter(userId);
    await this.setUserState(userId, USER_STATES.IDLE);

    const hasClothingAfterCharClear =
      await this.imageCacheService.hasClothing(userId);
    const replyMessage = this.replyService.createImageStatusMessage(
      false, // Character image cleared
      hasClothingAfterCharClear,
      "✅ 人物圖片已清除",
    );
    await this.sendReply(replyToken, [replyMessage]);
  }

  /**
   * Clears the user's clothing image and sends a confirmation message.
   * @private
   */
  private async handleClearClothing(
    userId: string,
    replyToken: string,
  ): Promise<void> {
    await this.imageCacheService.clearClothing(userId);
    await this.setUserState(userId, USER_STATES.IDLE);

    const hasCharacterAfterClothingClear =
      await this.imageCacheService.hasCharacter(userId);
    const replyMessage = this.replyService.createImageStatusMessage(
      hasCharacterAfterClothingClear,
      false, // Clothing image cleared
      "✅ 衣物圖片已清除",
    );
    await this.sendReply(replyToken, [replyMessage]);
  }

  /**
   * Clears all of the user's images and data.
   * @private
   */
  private async handleClearAll(
    userId: string,
    replyToken: string,
  ): Promise<void> {
    await this.imageCacheService.clearAll(userId);
    await this.userStateService.clearAllUserData(userId);
    const replyMessage = this.replyService.createAllClearedMessage();
    await this.sendReply(replyToken, [replyMessage]);
  }

  /**
   * Initiates image synthesis if both images are present, otherwise prompts for the missing image.
   * @private
   */
  private async handleSynthesizeImages(
    userId: string,
    replyToken: string,
  ): Promise<void> {
    const hasCharacter = await this.imageCacheService.hasCharacter(userId);
    const hasClothing = await this.imageCacheService.hasClothing(userId);

    if (hasCharacter && hasClothing) {
      await this.synthesizeImages(userId, replyToken);
      return;
    } else if (!hasCharacter && !hasClothing) {
      await this.setUserState(userId, USER_STATES.WAITING_FOR_CHARACTER);
      const replyMessage = this.replyService.createWaitingForCharacterMessage();
      await this.sendReply(replyToken, [replyMessage]);
      return;
    } else if (!hasCharacter) {
      await this.setUserState(userId, USER_STATES.WAITING_FOR_CHARACTER);
      const replyMessage = this.replyService.createWaitingForCharacterMessage();
      await this.sendReply(replyToken, [replyMessage]);
      return;
    } else if (!hasClothing) {
      await this.setUserState(userId, USER_STATES.WAITING_FOR_CLOTHING);
      const replyMessage = this.replyService.createWaitingForClothingMessage();
      await this.sendReply(replyToken, [replyMessage]);
      return;
    }
  }

  /**
   * Sends the user a help message with instructions.
   * @private
   */
  private async handleHelp(userId: string, replyToken: string): Promise<void> {
    await this.setUserState(userId, USER_STATES.IDLE);
    const replyMessage = this.replyService.createHelpMessage();
    await this.sendReply(replyToken, [replyMessage]);
  }

  /**
   * Sends the user a carousel of their currently stored images.
   * @private
   */
  private async handleBrowseImages(
    userId: string,
    replyToken: string,
  ): Promise<void> {
    await this.setUserState(userId, USER_STATES.IDLE);

    const characterUrl = await this.imageCacheService.getImageUrl(
      userId,
      "character",
    );
    const clothingUrl = await this.imageCacheService.getImageUrl(
      userId,
      "clothing",
    );
    const generatedUrl = await this.imageCacheService.getImageUrl(
      userId,
      "generated",
    );

    let replyMessage: messagingApi.Message;
    if (!characterUrl && !clothingUrl && !generatedUrl) {
      replyMessage = this.replyService.createErrorMessage(
        "您尚未上傳任何圖片，請先上傳人物或衣物圖片",
      );
    } else {
      replyMessage = this.replyService.createBrowseImagesMessage(
        characterUrl,
        clothingUrl,
        generatedUrl,
      );
    }
    await this.sendReply(replyToken, [replyMessage]);
  }

  /**
   * Sends the user a menu of available options.
   * @private
   */
  private async handleMoreOptions(
    userId: string,
    replyToken: string,
  ): Promise<void> {
    await this.setUserState(userId, USER_STATES.IDLE);
    const hasCharacter = await this.imageCacheService.hasCharacter(userId);
    const hasClothing = await this.imageCacheService.hasClothing(userId);
    const replyMessage = this.replyService.createImageStatusMessage(
      hasCharacter,
      hasClothing,
      "請選擇您要進行的操作：",
    );
    await this.sendReply(replyToken, [replyMessage]);
  }

  /**
   * Sends the generated image to the user for download.
   * @private
   */
  private async handleDownloadImage(
    userId: string,
    replyToken: string,
  ): Promise<void> {
    await this.setUserState(userId, USER_STATES.IDLE);
    const generatedUrl = await this.imageCacheService.getImageUrl(
      userId,
      "generated",
    );

    if (generatedUrl) {
      const replyMessage: messagingApi.ImageMessage = {
        type: "image",
        originalContentUrl: generatedUrl,
        previewImageUrl: generatedUrl,
      };
      await this.sendReply(replyToken, [replyMessage]);
    } else {
      const replyMessage = this.replyService.createErrorMessage(
        "❌ 沒有找到合成圖片，請先進行圖片合成",
      );
      await this.sendReply(replyToken, [replyMessage]);
    }
  }

  /**
   * Handles the user's selection of 'character' for a pending image.
   * @private
   */
  private async handleCharacterImageType(
    userId: string,
    replyToken: string,
  ): Promise<void> {
    await this.handleImageTypeSelection(userId, replyToken, "character");
  }

  /**
   * Handles the user's selection of 'clothing' for a pending image.
   * @private
   */
  private async handleClothingImageType(
    userId: string,
    replyToken: string,
  ): Promise<void> {
    await this.handleImageTypeSelection(userId, replyToken, "clothing");
  }

  /**
   * Handles the shared logic for processing an image after its type has been identified.
   * @private
   * @param {string} userId - The ID of the user.
   * @param {string} replyToken - The reply token for the event.
   * @param {'character' | 'clothing'} type - The type of the image being processed.
   */
  private async handleImageTypeSelection(
    userId: string,
    replyToken: string,
    type: "character" | "clothing",
  ): Promise<void> {
    const pendingImage = await this.getPendingImage(userId);
    if (!pendingImage) {
      const replyMessage =
        this.replyService.createErrorMessage(
          "找不到待處理的圖片，請重新上傳圖片",
        );
      await this.sendReply(replyToken, [replyMessage]);
      return;
    }

    try {
      const hasOppositeImage =
        type === "character"
          ? await this.imageCacheService.hasClothing(userId)
          : await this.imageCacheService.hasCharacter(userId);

      if (hasOppositeImage) {
        const inquiryMessage =
          type === "character"
            ? this.replyService.createUpdateClothingInquiryMessage()
            : this.replyService.createUpdateCharacterInquiryMessage();
        await this.sendReply(replyToken, [inquiryMessage]);
        return;
      }

      await this.imageCacheService.saveImage(
        userId,
        pendingImage.imageId,
        type,
      );
      await this.setUserState(userId, USER_STATES.IDLE);
      await this.clearPendingImage(userId);

      const confirmMessage = this.replyService.createImageReceivedMessage(type);
      await this.sendReply(replyToken, [confirmMessage]);

      const hasOppositeImageAfterSave =
        type === "character"
          ? await this.imageCacheService.hasClothing(userId)
          : await this.imageCacheService.hasCharacter(userId);

      if (hasOppositeImageAfterSave) {
        await this.synthesizeImages(userId, replyToken);
      } else {
        const waitingMessage =
          type === "character"
            ? this.replyService.createWaitingForClothingMessage()
            : this.replyService.createWaitingForCharacterMessage();

        // 使用快速回復來提示用戶下一步操作，包含原本的快速回復選項
        const messageWithQuickReply: messagingApi.TextMessage = {
          type: "text",
          text: waitingMessage.text,
          quickReply: {
            items: [
              {
                type: "action",
                action: {
                  type: "message",
                  label: type === "character" ? "上傳衣物圖片" : "上傳人物圖片",
                  text:
                    type === "character" ? "/上傳衣物圖片" : "/上傳人物圖片",
                },
              },
              {
                type: "action",
                action: {
                  type: "message",
                  label: "更多選項",
                  text: "/更多選項",
                },
              },
            ],
          },
        };

        // 使用 sendReply 替代 pushMessage
        await this.sendReply(replyToken, [messageWithQuickReply]);
        return; // 避免重複回應
      }
    } catch (error) {
      this.logger.handleError(error as Error);
      const errorMessage =
        this.replyService.createErrorMessage("圖片儲存失敗，請稍後再試");
      await this.sendReply(replyToken, [errorMessage]);
    }
  }

  /**
   * Sets the user's state to wait for a clothing image to be updated.
   * @private
   */
  private async handleUpdateClothing(
    userId: string,
    replyToken: string,
  ): Promise<void> {
    await this.setUserState(userId, USER_STATES.WAITING_FOR_CLOTHING);
    const replyMessage = this.replyService.createWaitingForClothingMessage();
    await this.sendReply(replyToken, [replyMessage]);
  }

  /**
   * Sets the user's state to wait for a character image to be updated.
   * @private
   */
  private async handleUpdateCharacter(
    userId: string,
    replyToken: string,
  ): Promise<void> {
    await this.setUserState(userId, USER_STATES.WAITING_FOR_CHARACTER);
    const replyMessage = this.replyService.createWaitingForCharacterMessage();
    await this.sendReply(replyToken, [replyMessage]);
  }

  /**
   * Initiates image synthesis directly, assuming both images exist.
   * @private
   */
  private async handleDirectSynthesize(
    userId: string,
    replyToken: string,
  ): Promise<void> {
    await this.synthesizeImages(userId, replyToken);
  }

  /**
   * Handles unrecognized commands or provides context-sensitive replies.
   * @private
   */
  private async handleDefault(
    userId: string,
    text: string,
    replyToken: string,
  ): Promise<void> {
    const currentState = await this.getUserState(userId);

    if (currentState === USER_STATES.WAITING_FOR_IMAGE_TYPE) {
      const replyMessage: messagingApi.TextMessage = {
        type: "text",
        text: "請選擇剛上傳的圖片是人物圖片還是衣物圖片：",
        quickReply: {
          items: [
            {
              type: "action",
              action: {
                type: "message",
                label: "人物圖片",
                text: "人物圖片",
              },
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "衣物圖片",
                text: "衣物圖片",
              },
            },
          ],
        },
      };
      await this.sendReply(replyToken, [replyMessage]);
    } else {
      await this.setUserState(userId, USER_STATES.IDLE);
      const hasCharacter = await this.imageCacheService.hasCharacter(userId);
      const hasClothing = await this.imageCacheService.hasClothing(userId);
      const replyMessage = this.replyService.createImageStatusMessage(
        hasCharacter,
        hasClothing,
        "請選擇您要進行的操作：",
      );
      await this.sendReply(replyToken, [replyMessage]);
    }
  }

  /**
   * Performs the image synthesis by calling the Gemini provider.
   * @private
   * @param {string} userId - The ID of the user for whom to synthesize images.
   * @param {string} replyToken - The reply token for sending responses.
   */
  private async synthesizeImages(
    userId: string,
    replyToken: string,
  ): Promise<void> {
    // Check if we can proceed with synthesis immediately
    const lockResult = await this.userStateService.executeWithLock(
      userId,
      "image_synthesis",
      async () => {
        const hasBothImages =
          await this.imageCacheService.hasBothImages(userId);
        if (!hasBothImages) {
          throw new Error("Missing image data for synthesis");
        }
        return true;
      },
    );

    // Handle lock acquisition failure - send busy message as reply
    if (!lockResult.success) {
      this.logger.log(
        `Synthesis blocked for user ${userId}: ${lockResult.error}`,
        {
          color: "yellow",
        },
      );
      const busyMessage = this.replyService.createErrorMessage(
        "🔄 Processing, please wait a moment",
      );
      await this.sendReply(replyToken, [busyMessage]);
      return;
    }

    // Send processing message as reply with check results button
    const processingMessage = this.replyService.createProcessingMessage();
    await this.sendReply(replyToken, [processingMessage]);

    // Start background synthesis and store results in Redis
    this.performBackgroundSynthesis(userId).catch((error) => {
      this.logger.handleError(error);
    });
  }

  /**
   * Performs the actual image synthesis in the background and stores result in Redis.
   * No push messages are sent - users check results via "/查看結果" command.
   * @private
   */
  private async performBackgroundSynthesis(userId: string): Promise<void> {
    const result = await this.userStateService.executeWithLock(
      userId,
      "image_synthesis",
      async () => {
        this.logger.log(
          `Starting background image synthesis for user ${userId}`,
          {
            color: "blue",
          },
        );

        // Transition to generating_image state
        const stateTransitioned =
          await this.userStateService.transitionUserState(
            userId,
            USER_STATES.IDLE,
            USER_STATES.GENERATING_IMAGE,
          );

        if (!stateTransitioned) {
          throw new Error("User is not in idle state, cannot start synthesis");
        }

        // Set initial processing status in Redis
        await this.userStateService.setSynthesisResult(userId, {
          status: "processing",
          timestamp: Date.now(),
        });

        try {
          const generatedImagePath =
            await GeminiProvider.getInstance().synthesizeImages(
              path.join(process.cwd(), "images", userId, "character.jpg"),
              path.join(process.cwd(), "images", userId, "clothing.jpg"),
              userId,
            );

          await this.imageCacheService.saveGeneratedImagePath(
            userId,
            generatedImagePath,
          );

          // Store successful result in Redis
          await this.userStateService.setSynthesisResult(userId, {
            status: "completed",
            imagePath: generatedImagePath,
            timestamp: Date.now(),
          });

          this.logger.log(`Background synthesis completed for user ${userId}`, {
            color: "green",
          });

          // Reset state to idle after successful synthesis
          await this.userStateService.setUserState(userId, USER_STATES.IDLE);
        } catch (error) {
          // Reset state to idle on error
          await this.userStateService.setUserState(userId, USER_STATES.IDLE);

          // Store failure result in Redis
          await this.userStateService.setSynthesisResult(userId, {
            status: "failed",
            errorMessage: (error as Error).message,
            timestamp: Date.now(),
          });

          this.logger.handleError(error as Error);
        }
      },
    );

    if (result.error) {
      // Store failure result for lock acquisition failure
      await this.userStateService.setSynthesisResult(userId, {
        status: "failed",
        errorMessage: result.error,
        timestamp: Date.now(),
      });
      this.logger.handleError(new Error(result.error));
    }
  }

  /**
   * Handles checking synthesis result when user clicks "查看結果"
   * @private
   */
  private async handleCheckSynthesisResult(
    userId: string,
    replyToken: string,
  ): Promise<void> {
    const userState = await this.getUserState(userId);
    const synthesisResult =
      await this.userStateService.getSynthesisResult(userId);

    if (userState === USER_STATES.GENERATING_IMAGE) {
      // Still processing
      const processingMessage =
        this.replyService.createStillProcessingMessage();
      await this.sendReply(replyToken, [processingMessage]);
    } else if (
      synthesisResult?.status === "completed" &&
      synthesisResult.imagePath
    ) {
      // Success - send result
      const generatedImageUrl = this.convertPathToUrl(
        synthesisResult.imagePath,
      );
      const completedTextMessage: messagingApi.TextMessage = {
        type: "text",
        text: "✨ 圖片已完成",
      };
      const resultMessage =
        this.replyService.createSynthesisResultWithImageMessage(
          generatedImageUrl,
        );
      await this.sendReply(replyToken, [completedTextMessage, resultMessage]);

      // Clear synthesis result after successful delivery
      await this.userStateService.clearSynthesisResult(userId);
    } else if (synthesisResult?.status === "failed") {
      // Failed - send error with re-upload options
      const errorMessage = this.replyService.createSynthesisFailedMessage();
      await this.sendReply(replyToken, [errorMessage]);

      // Clear synthesis result after error delivery
      await this.userStateService.clearSynthesisResult(userId);
    } else {
      // No active synthesis or unknown status
      const noActiveMessage =
        this.replyService.createNoActiveSynthesisMessage();
      await this.sendReply(replyToken, [noActiveMessage]);
    }
  }

  /**
   * Converts a local file path to a publicly accessible URL.
   * @private
   * @param {string} filePath - The local path to the image file.
   * @returns {string} The public URL for the image.
   */
  private convertPathToUrl(filePath: string): string {
    const baseUrl = this.config.getConfig().BASE_URL || "http://localhost:8000";
    const relativePath = filePath.replace(
      path.join(process.cwd(), "images"),
      "",
    );
    return `${baseUrl}/images${relativePath}`;
  }

  /**
   * Resets a user's state and clears all their data. Development only.
   * @private
   */
  private async handleInit(userId: string, replyToken: string): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      const errorMessage = this.replyService.createErrorMessage(
        "This command is for development use only",
      );
      await this.sendReply(replyToken, [errorMessage]);
      return;
    }

    await this.userStateService.clearAllUserData(userId);
    await this.imageCacheService.clearAll(userId);

    const welcomeMessage = this.replyService.createHelpMessage();
    await this.sendReply(replyToken, [welcomeMessage]);

    this.logger.log(
      `Init command executed for user ${userId} - all data cleared`,
      { color: "blue" },
    );
  }

  /**
   * Sends a reply message to the user via the LINE Messaging API.
   * @private
   * @param {string} replyToken - The reply token for the event.
   * @param {messagingApi.Message[]} messages - An array of messages to send.
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

export default CommandService;
