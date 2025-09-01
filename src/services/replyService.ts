import { messagingApi } from "@line/bot-sdk";

import {
  allClearedMessage,
  characterImageClearedMessage,
  clothingImageClearedMessage,
  commandReply,
  createAfterSynthesisMenuMessage,
  createBrowseImagesMessage,
  createErrorMessage,
  createImageReceivedMessage,
  createImageStatusMessage,
  createImageTypeInquiryMessage,
  createSynthesisResultMessage,
  createUpdateCharacterInquiryMessage,
  createUpdateClothingInquiryMessage,
  helpMessage,
  processingMessage,
  waitingForCharacterMessage,
  waitingForClothingMessage,
  welcomeMessage,
} from "../utils/reply/messages";

/**
 * @class ReplyService
 * @description A factory service for creating various LINE message objects.
 * It encapsulates the logic for generating message structures.
 */
class ReplyService {
  private static instance: ReplyService;

  /**
   * Private constructor for the Singleton pattern.
   * @private
   */
  private constructor() {}

  /**
   * Gets the singleton instance of the ReplyService.
   * @returns {ReplyService} The singleton instance.
   */
  public static getInstance(): ReplyService {
    if (!ReplyService.instance) {
      ReplyService.instance = new ReplyService();
    }
    return ReplyService.instance;
  }

  /**
   * Creates a reply message with buttons for all available commands.
   * @returns {messagingApi.TextMessage} A LINE text message object.
   */
  public createCommandReply(): messagingApi.TextMessage {
    return commandReply;
  }

  /**
   * Creates a welcome message for new users.
   * @returns {messagingApi.TextMessage} A LINE text message object.
   */
  public createWelcomeMessage(): messagingApi.TextMessage {
    return welcomeMessage;
  }

  /**
   * Creates a help message with instructions on how to use the bot.
   * @returns {messagingApi.TextMessage} A LINE text message object.
   */
  public createHelpMessage(): messagingApi.TextMessage {
    return helpMessage;
  }

  /**
   * Creates a confirmation message for clearing the character image.
   * @returns {messagingApi.TextMessage} A LINE text message object.
   */
  public createCharacterImageClearedMessage(): messagingApi.TextMessage {
    return characterImageClearedMessage;
  }

  /**
   * Creates a confirmation message for clearing the clothing image.
   * @returns {messagingApi.TextMessage} A LINE text message object.
   */
  public createClothingImageClearedMessage(): messagingApi.TextMessage {
    return clothingImageClearedMessage;
  }

  /**
   * Creates a confirmation message for clearing all images.
   * @returns {messagingApi.TextMessage} A LINE text message object.
   */
  public createAllClearedMessage(): messagingApi.TextMessage {
    return allClearedMessage;
  }

  /**
   * Creates a message to inform the user that processing is in progress.
   * @returns {messagingApi.TextMessage} A LINE text message object.
   */
  public createProcessingMessage(): messagingApi.TextMessage {
    return processingMessage;
  }

  /**
   * Creates a message prompting the user to upload a character image.
   * @returns {messagingApi.TextMessage} A LINE text message object.
   */
  public createWaitingForCharacterMessage(): messagingApi.TextMessage {
    return waitingForCharacterMessage;
  }

  /**
   * Creates a message prompting the user to upload a clothing image.
   * @returns {messagingApi.TextMessage} A LINE text message object.
   */
  public createWaitingForClothingMessage(): messagingApi.TextMessage {
    return waitingForClothingMessage;
  }

  /**
   * Creates a confirmation message after an image has been received.
   * @param {'character' | 'clothing'} type - The type of image received.
   * @returns {messagingApi.TextMessage} A LINE text message object.
   */
  public createImageReceivedMessage(
    type: "character" | "clothing",
  ): messagingApi.TextMessage {
    return createImageReceivedMessage(type);
  }

  /**
   * Creates a generic error message.
   * @param {string} [message] - An optional custom error message.
   * @returns {messagingApi.TextMessage} A LINE text message object.
   */
  public createErrorMessage(message?: string): messagingApi.TextMessage {
    return createErrorMessage(message);
  }

  /**
   * Creates a menu message to be shown after image synthesis is complete.
   * @returns {messagingApi.TextMessage} A LINE text message object.
   */
  public createAfterSynthesisMenuMessage(): messagingApi.TextMessage {
    return createAfterSynthesisMenuMessage();
  }

  /**
   * Creates a dynamic status message with quick replies based on image availability.
   * @param {boolean} hasCharacter - Whether the user has a character image.
   * @param {boolean} hasClothing - Whether the user has a clothing image.
   * @param {string} [message] - An optional introductory message.
   * @returns {messagingApi.TextMessage} A LINE text message object.
   */
  public createImageStatusMessage(
    hasCharacter: boolean,
    hasClothing: boolean,
    message?: string,
  ): messagingApi.TextMessage {
    return createImageStatusMessage(hasCharacter, hasClothing, message);
  }

  /**
   * Creates a text message showing the result of the synthesis (legacy).
   * @param {string} characterId - The ID of the character image.
   * @param {string} clothingId - The ID of the clothing image.
   * @returns {messagingApi.TextMessage} A LINE text message object.
   */
  public createSynthesisResultMessage(
    characterId: string,
    clothingId: string,
  ): messagingApi.TextMessage {
    return createSynthesisResultMessage(characterId, clothingId);
  }

  /**
   * Creates an image message containing the synthesized result.
   * @param {string} generatedImageUrl - The public URL of the generated image.
   * @returns {messagingApi.ImageMessage} A LINE image message object.
   */
  public createSynthesisResultWithImageMessage(
    generatedImageUrl: string,
  ): messagingApi.ImageMessage {
    return {
      type: "image",
      originalContentUrl: generatedImageUrl,
      previewImageUrl: generatedImageUrl,
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
          {
            type: "action",
            action: {
              type: "message",
              label: "全部清除",
              text: "/全部清除",
            },
          },
        ],
      },
    };
  }

  /**
   * Creates a Flex Message carousel to browse the user's current images.
   * @param {string | null} characterUrl - The URL of the character image.
   * @param {string | null} clothingUrl - The URL of the clothing image.
   * @param {string | null} [generatedUrl] - The URL of the generated image.
   * @returns {messagingApi.FlexMessage} A LINE Flex Message object.
   */
  public createBrowseImagesMessage(
    characterUrl: string | null,
    clothingUrl: string | null,
    generatedUrl: string | null = null,
  ): messagingApi.FlexMessage {
    return createBrowseImagesMessage(characterUrl, clothingUrl, generatedUrl);
  }

  /**
   * Creates a message asking the user to specify the type of an uploaded image.
   * @returns {messagingApi.TextMessage} A LINE text message object.
   */
  public createImageTypeInquiryMessage(): messagingApi.TextMessage {
    return createImageTypeInquiryMessage();
  }

  /**
   * Creates a message asking if the user wants to update the existing clothing image.
   * @returns {messagingApi.TextMessage} A LINE text message object.
   */
  public createUpdateClothingInquiryMessage(): messagingApi.TextMessage {
    return createUpdateClothingInquiryMessage();
  }

  /**
   * Creates a message asking if the user wants to update the existing character image.
   * @returns {messagingApi.TextMessage} A LINE text message object.
   */
  public createUpdateCharacterInquiryMessage(): messagingApi.TextMessage {
    return createUpdateCharacterInquiryMessage();
  }
}

export default ReplyService;
