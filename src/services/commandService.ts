import { messagingApi } from "@line/bot-sdk";
import * as path from "path";

import GeminiProvider from "../providers/gemini";
import LineProvider from "../providers/line";
import ConsoleHandler from "../utils/consoleHandler";
import ConfigService from "./configService";
import ImageCacheService from "./imageCacheService";
import ReplyService from "./replyService";

// Defines the possible states of a user in the conversation flow.
type UserState =
  | "waiting_for_character"
  | "waiting_for_clothing"
  | "waiting_for_image_type"
  | "idle";

// Defines the function signature for a command handler.
type CommandHandler = (userId: string, replyToken: string) => Promise<void>;

// Defines the structure for a pending image that awaits type confirmation.
type PendingImage = {
  imageId: string;
  timestamp: number;
};

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
  private logger = ConsoleHandler.getInstance("CommandService");
  private userStates: Map<string, UserState>;
  private commandHandlers: Map<string, CommandHandler> = new Map();
  private pendingImages: Map<string, PendingImage> = new Map();

  /**
   * Private constructor for the Singleton pattern.
   * @param {Map<string, UserState>} userStates - A map to manage user states, passed from LineService.
   */
  private constructor(userStates: Map<string, UserState>) {
    this.lineProvider = LineProvider.getInstance();
    this.imageCacheService = ImageCacheService.getInstance();
    this.replyService = ReplyService.getInstance();
    this.config = ConfigService.getInstance();
    this.userStates = userStates;

    this.initializeCommandHandlers();
  }

  /**
   * Gets the singleton instance of the CommandService.
   * @param {Map<string, UserState>} userStates - A map to manage user states.
   * @returns {CommandService} The singleton instance.
   */
  public static getInstance(
    userStates: Map<string, UserState>,
  ): CommandService {
    if (!CommandService.instance) {
      CommandService.instance = new CommandService(userStates);
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
    this.userStates.set(userId, "waiting_for_character");
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
    this.userStates.set(userId, "waiting_for_clothing");
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
    this.userStates.set(userId, "idle");

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
    this.userStates.set(userId, "idle");

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
    this.imageCacheService.clearAll(userId);
    this.userStates.set(userId, "idle");
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
      // The synthesizeImages method sends its own status messages.
      await this.synthesizeImages(userId);
      return;
    } else if (!hasCharacter && !hasClothing) {
      this.userStates.set(userId, "waiting_for_character");
      const replyMessage = this.replyService.createWaitingForCharacterMessage();
      await this.sendReply(replyToken, [replyMessage]);
      return;
    } else if (!hasCharacter) {
      this.userStates.set(userId, "waiting_for_character");
      const replyMessage = this.replyService.createWaitingForCharacterMessage();
      await this.sendReply(replyToken, [replyMessage]);
      return;
    } else if (!hasClothing) {
      this.userStates.set(userId, "waiting_for_clothing");
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
    this.userStates.set(userId, "idle");
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
    this.userStates.set(userId, "idle");

    const characterUrl = this.imageCacheService.getImageUrl(
      userId,
      "character",
    );
    const clothingUrl = this.imageCacheService.getImageUrl(userId, "clothing");
    const generatedUrl = this.imageCacheService.getImageUrl(
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
    this.userStates.set(userId, "idle");
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
    this.userStates.set(userId, "idle");
    const generatedUrl = this.imageCacheService.getImageUrl(
      userId,
      "generated",
    );

    if (generatedUrl) {
      const downloadMessage: messagingApi.ImageMessage = {
        type: "image",
        originalContentUrl: generatedUrl,
        previewImageUrl: generatedUrl,
      };

      const textMessage: messagingApi.TextMessage = {
        type: "text",
        text: "📱 請長按圖片並選擇「儲存圖片」來下載到您的相簿",
      };

      const client = this.lineProvider.getMessagingClient();
      await client.pushMessage({
        to: userId,
        messages: [textMessage, downloadMessage],
      });

      const replyMessage: messagingApi.TextMessage = {
        type: "text",
        text: "✅ 已為您顯示合成圖片，請長按圖片儲存到相簿",
        quickReply: {
          items: [
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
    const pendingImage = this.pendingImages.get(userId);
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
      this.userStates.set(userId, "idle");
      this.pendingImages.delete(userId);

      const confirmMessage = this.replyService.createImageReceivedMessage(type);
      await this.sendReply(replyToken, [confirmMessage]);

      const hasOppositeImageAfterSave =
        type === "character"
          ? await this.imageCacheService.hasClothing(userId)
          : await this.imageCacheService.hasCharacter(userId);

      if (hasOppositeImageAfterSave) {
        await this.synthesizeImages(userId);
      } else {
        const waitingMessage =
          type === "character"
            ? this.replyService.createWaitingForClothingMessage()
            : this.replyService.createWaitingForCharacterMessage();
        const client = this.lineProvider.getMessagingClient();
        await client.pushMessage({
          to: userId,
          messages: [waitingMessage],
        });
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
    this.userStates.set(userId, "waiting_for_clothing");
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
    this.userStates.set(userId, "waiting_for_character");
    const replyMessage = this.replyService.createWaitingForCharacterMessage();
    await this.sendReply(replyToken, [replyMessage]);
  }

  /**
   * Initiates image synthesis directly, assuming both images exist.
   * @private
   */
  private async handleDirectSynthesize(
    userId: string,
    _replyToken: string,
  ): Promise<void> {
    await this.synthesizeImages(userId);
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
    const currentState = this.userStates.get(userId);

    if (currentState === "waiting_for_image_type") {
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
      this.userStates.set(userId, "idle");
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
   */
  private async synthesizeImages(userId: string): Promise<void> {
    try {
      this.logger.log(`Starting image synthesis for user ${userId}`, {
        color: "blue",
      });

      const processingMessage = this.replyService.createProcessingMessage();
      const client = this.lineProvider.getMessagingClient();
      await client.pushMessage({
        to: userId,
        messages: [processingMessage],
      });

      const hasBothImages = await this.imageCacheService.hasBothImages(userId);
      if (!hasBothImages) {
        throw new Error("Missing image data for synthesis");
      }

      const generatedImagePath =
        await GeminiProvider.generateImagePhoto(userId);
      this.imageCacheService.saveGeneratedImagePath(userId, generatedImagePath);

      const generatedImageUrl = this.convertPathToUrl(generatedImagePath);

      const completedTextMessage: messagingApi.TextMessage = {
        type: "text",
        text: "✨ 圖片已完成",
      };

      const resultMessage =
        this.replyService.createSynthesisResultWithImageMessage(
          generatedImageUrl,
        );

      await client.pushMessage({
        to: userId,
        messages: [completedTextMessage, resultMessage],
      });

      this.logger.log(`Image synthesis completed for user ${userId}`, {
        color: "green",
      });
    } catch (error) {
      this.logger.handleError(error as Error);

      const errorMessage =
        this.replyService.createErrorMessage("合成過程中發生錯誤，請稍後再試");
      const client = this.lineProvider.getMessagingClient();
      await client.pushMessage({
        to: userId,
        messages: [errorMessage],
      });
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
   * Stores a pending image ID for a user who has uploaded an image
   * but has not yet specified its type.
   * @param {string} userId - The ID of the user.
   * @param {string} imageId - The ID of the uploaded image.
   */
  public setPendingImage(userId: string, imageId: string): void {
    this.pendingImages.set(userId, {
      imageId: imageId,
      timestamp: Date.now(),
    });
    this.userStates.set(userId, "waiting_for_image_type");
    this.logger.log(`Set pending image for user ${userId}`, { color: "blue" });
  }

  /**
   * Clears the pending image for a user.
   * @param {string} userId - The ID of the user.
   */
  public clearPendingImage(userId: string): void {
    this.pendingImages.delete(userId);
    this.logger.log(`Cleared pending image for user ${userId}`, {
      color: "yellow",
    });
  }

  /**
   * Resets a user's state and clears all their data. Development only.
   * @private
   */
  private async handleInit(userId: string, replyToken: string): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      const errorMessage =
        this.replyService.createErrorMessage("此指令僅限開發環境使用");
      await this.sendReply(replyToken, [errorMessage]);
      return;
    }

    this.userStates.set(userId, "idle");
    this.clearPendingImage(userId);
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
