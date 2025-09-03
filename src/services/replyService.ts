import { messagingApi } from "@line/bot-sdk";

import * as passiveTemplates from "../utils/reply/passiveFlowTemplates";

/**
 * @class ReplyService
 * @description Intent-based reply service for the refactored architecture
 */
class ReplyService {
  private static instance: ReplyService;

  private constructor() {}

  public static getInstance(): ReplyService {
    if (!ReplyService.instance) {
      ReplyService.instance = new ReplyService();
    }
    return ReplyService.instance;
  }

  // === Passive Flow Replies ===

  /**
   * Welcome message with start button
   */
  public createWelcomeReply(): messagingApi.TextMessage {
    return passiveTemplates.welcomeMessage;
  }

  /**
   * Request character image upload
   */
  public createRequestCharacterReply(): messagingApi.TextMessage {
    return passiveTemplates.requestCharacterMessage;
  }

  /**
   * Request clothing image upload
   */
  public createRequestClothingReply(): messagingApi.TextMessage {
    return passiveTemplates.requestClothingMessage;
  }

  /**
   * Processing message during synthesis
   */
  public createProcessingReply(): messagingApi.TextMessage {
    return passiveTemplates.processingMessage;
  }

  /**
   * Still processing message
   */
  public createStillProcessingReply(): messagingApi.TextMessage {
    return passiveTemplates.stillProcessingMessage;
  }

  /**
   * Synthesis complete message
   */
  public createSynthesisCompleteReply(): messagingApi.TextMessage {
    return passiveTemplates.synthesisCompleteMessage;
  }

  /**
   * Post-synthesis options
   */
  public createPostSynthesisOptionsReply(): messagingApi.TextMessage {
    return passiveTemplates.postSynthesisOptionsMessage;
  }

  /**
   * Multi-image warning
   */
  public createMultiImageWarningReply(): messagingApi.TextMessage {
    return passiveTemplates.multiImageWarningMessage;
  }

  /**
   * Character image cleared confirmation
   */
  public createCharacterClearedReply(): messagingApi.TextMessage {
    return passiveTemplates.characterClearedMessage;
  }

  /**
   * Clothing image cleared confirmation
   */
  public createClothingClearedReply(): messagingApi.TextMessage {
    return passiveTemplates.clothingClearedMessage;
  }

  /**
   * All images cleared confirmation
   */
  public createAllClearedReply(): messagingApi.TextMessage {
    return passiveTemplates.allClearedMessage;
  }

  /**
   * Synthesis result image message
   */
  public createSynthesisResultImageReply(
    imageUrl: string,
  ): messagingApi.ImageMessage {
    return passiveTemplates.createSynthesisResultImageMessage(imageUrl);
  }

  /**
   * Request re-upload of character image
   */
  public createRequestReUploadCharacterReply(): messagingApi.TextMessage {
    return passiveTemplates.requestReUploadCharacterMessage;
  }

  /**
   * Request re-upload of clothing image
   */
  public createRequestReUploadClothingReply(): messagingApi.TextMessage {
    return passiveTemplates.requestReUploadClothingMessage;
  }

  /**
   * Generic error message
   */
  public createErrorReply(message?: string): messagingApi.TextMessage {
    return passiveTemplates.createErrorMessage(message);
  }
}

export default ReplyService;
