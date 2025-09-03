import { messagingApi } from "@line/bot-sdk";

import ConsoleHandler from "../../utils/consoleHandler";
import CommandParserService, {
  ParsedCommand,
  PassiveCommand,
} from "../commandParserService";
import { FlowEvent } from "../flowManagerService";
import ReplyService from "../replyService";
import UserStateService, { USER_STATES, UserState } from "../userStateService";

/**
 * @class TextMessageHandlerService
 * @description Handles all text message processing logic based on user state
 * Extracted from FlowManagerService to follow single responsibility principle
 */
class TextMessageHandlerService {
  private static instance: TextMessageHandlerService;
  private logger = ConsoleHandler.getInstance("TextMessageHandlerService");
  private commandParserService: CommandParserService;
  private replyService: ReplyService;
  private userStateService: UserStateService;

  /**
   * Private constructor for the Singleton pattern.
   * Initializes service dependencies and prevents direct instantiation
   * @private
   */
  private constructor() {
    this.commandParserService = CommandParserService.getInstance();
    this.replyService = ReplyService.getInstance();
    this.userStateService = UserStateService.getInstance();
  }

  /**
   * Gets the singleton instance of the TextMessageHandlerService.
   * Implements lazy initialization with thread-safe instance creation
   * @returns {TextMessageHandlerService} The singleton instance
   * @static
   */
  public static getInstance(): TextMessageHandlerService {
    if (!TextMessageHandlerService.instance) {
      TextMessageHandlerService.instance = new TextMessageHandlerService();
    }
    return TextMessageHandlerService.instance;
  }

  /**
   * Handle text messages based on current user state
   * Uses state machine pattern to route messages to appropriate handlers
   * Delegates complex operations to external handlers for separation of concerns
   * @param event - The text message event containing user input
   * @param currentState - The user's current state for context-aware processing
   * @param handlers - Object containing external handlers for complex operations
   * @param sendReply - Function to send reply messages back to user
   * @returns Promise<void>
   * @throws {Error} Propagates handler errors after logging
   * @example
   * await textHandler.handleTextMessage(event, "idle", {
   *   startPassiveFlow: async (event) => { ... },
   *   clearCharacterImage: async (event) => { ... }
   * }, sendReply);
   */
  public async handleTextMessage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
    currentState: UserState,
    handlers: {
      startPassiveFlow: (
        event: FlowEvent & { type: "TEXT_MESSAGE" },
      ) => Promise<void>;
      clearCharacterImage: (
        event: FlowEvent & { type: "TEXT_MESSAGE" },
      ) => Promise<void>;
      clearClothingImage: (
        event: FlowEvent & { type: "TEXT_MESSAGE" },
      ) => Promise<void>;
      handleClearAllCommand: (
        event: FlowEvent & { type: "TEXT_MESSAGE" },
      ) => Promise<void>;
      handleDevInit: (
        event: FlowEvent & { type: "TEXT_MESSAGE" },
      ) => Promise<void>;
      regenerateImage: (
        event: FlowEvent & { type: "TEXT_MESSAGE" },
      ) => Promise<void>;
      checkSynthesisResult: (
        event: FlowEvent & { type: "TEXT_MESSAGE" },
      ) => Promise<void>;
    },
    sendReply: (
      replyToken: string,
      messages: messagingApi.Message[],
    ) => Promise<void>,
  ): Promise<void> {
    const command = this.commandParserService.parseCommand(event.text);

    this.logger.log(
      `Handling text message in state ${currentState}: "${event.text}"`,
      { color: "cyan" },
    );

    switch (currentState) {
      case USER_STATES.IDLE:
        await this.handleIdleTextMessage(event, command, handlers, sendReply);
        break;
      case USER_STATES.PASSIVE_AWAITING_CHARACTER:
        await this.handleAwaitingCharacterTextMessage(
          event,
          command,
          handlers,
          sendReply,
        );
        break;
      case USER_STATES.PASSIVE_AWAITING_CLOTHING:
        await this.handleAwaitingClothingTextMessage(
          event,
          command,
          handlers,
          sendReply,
        );
        break;
      case USER_STATES.GENERATING_IMAGE:
        await this.handleGeneratingImageTextMessage(
          event,
          command,
          handlers,
          sendReply,
        );
        break;
      case USER_STATES.PASSIVE_AWAITING_RESULT_CHECK_CHARACTER:
        await this.handleAwaitingResultCharacterTextMessage(
          event,
          command,
          handlers,
          sendReply,
        );
        break;
      case USER_STATES.PASSIVE_AWAITING_RESULT_CHECK_CLOTHING:
        await this.handleAwaitingResultClothingTextMessage(
          event,
          command,
          handlers,
          sendReply,
        );
        break;
      default: {
        this.logger.log(`Unknown state: ${currentState}`, { color: "yellow" });
        const unknownStateMessage = this.replyService.createWelcomeReply();
        await sendReply(event.replyToken, [unknownStateMessage]);
        break;
      }
    }
  }

  /**
   * Handle text messages in idle state
   * Processes commands when user is in idle state, supporting flow initiation and image management
   * @param event - The text message event
   * @param command - Parsed command from the text message
   * @param handlers - External handlers for delegated operations
   * @param sendReply - Function to send reply messages
   * @private
   */
  private async handleIdleTextMessage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
    command: ParsedCommand,
    handlers: any,
    sendReply: (
      replyToken: string,
      messages: messagingApi.Message[],
    ) => Promise<void>,
  ): Promise<void> {
    switch (command.type) {
      case PassiveCommand.START_FLOW:
        await handlers.startPassiveFlow(event);
        break;
      case PassiveCommand.CLEAR_CHARACTER:
        await handlers.clearCharacterImage(event);
        break;
      case PassiveCommand.CLEAR_CLOTHING:
        await handlers.clearClothingImage(event);
        break;
      case PassiveCommand.CLEAR_ALL:
        await handlers.handleClearAllCommand(event);
        break;
      case PassiveCommand.DEV_INIT:
        await handlers.handleDevInit(event);
        break;
      case PassiveCommand.REGENERATE:
        await handlers.regenerateImage(event);
        break;
      case PassiveCommand.REUPLOAD_CHARACTER: {
        await handlers.clearCharacterImage(event);
        await this.userStateService.setUserState(
          event.userId,
          USER_STATES.PASSIVE_AWAITING_CHARACTER,
        );
        const characterMessage =
          this.replyService.createRequestReUploadCharacterReply();
        await sendReply(event.replyToken, [characterMessage]);
        break;
      }
      case PassiveCommand.REUPLOAD_CLOTHING: {
        await handlers.clearClothingImage(event);
        await this.userStateService.setUserState(
          event.userId,
          USER_STATES.PASSIVE_AWAITING_CLOTHING,
        );
        const clothingMessage =
          this.replyService.createRequestReUploadClothingReply();
        await sendReply(event.replyToken, [clothingMessage]);
        break;
      }
      default: {
        // Return to welcome state
        const welcomeMessage = this.replyService.createWelcomeReply();
        await sendReply(event.replyToken, [welcomeMessage]);
      }
    }
  }

  /**
   * Handle text messages while awaiting character image
   * Processes user input during character image upload wait state
   * Supports clearing operations and reminds user of expected action
   * @param event - The text message event
   * @param command - Parsed command from the text message
   * @param handlers - External handlers for delegated operations
   * @param sendReply - Function to send reply messages
   * @private
   */
  private async handleAwaitingCharacterTextMessage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
    command: ParsedCommand,
    handlers: any,
    sendReply: (
      replyToken: string,
      messages: messagingApi.Message[],
    ) => Promise<void>,
  ): Promise<void> {
    switch (command.type) {
      case PassiveCommand.CLEAR_ALL:
        await handlers.handleClearAllCommand(event);
        break;
      default: {
        // Error: expecting image but received text message
        const errorMessage = this.replyService.createExpectingImageErrorReply();
        await sendReply(event.replyToken, [errorMessage]);
      }
    }
  }

  /**
   * Handle text messages while awaiting clothing image
   */
  private async handleAwaitingClothingTextMessage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
    command: ParsedCommand,
    handlers: any,
    sendReply: (
      replyToken: string,
      messages: messagingApi.Message[],
    ) => Promise<void>,
  ): Promise<void> {
    switch (command.type) {
      case PassiveCommand.CLEAR_CHARACTER:
        await handlers.clearCharacterImage(event);
        await handlers.startPassiveFlow(event);
        break;
      case PassiveCommand.CLEAR_ALL:
        await handlers.handleClearAllCommand(event);
        break;
      default: {
        // Error: expecting image but received text message
        const errorMessage = this.replyService.createExpectingImageErrorReply();
        await sendReply(event.replyToken, [errorMessage]);
      }
    }
  }

  /**
   * Handle text messages during image generation
   */
  private async handleGeneratingImageTextMessage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
    command: ParsedCommand,
    handlers: any,
    sendReply: (
      replyToken: string,
      messages: messagingApi.Message[],
    ) => Promise<void>,
  ): Promise<void> {
    switch (command.type) {
      case PassiveCommand.CHECK_RESULT:
        await handlers.checkSynthesisResult(event);
        break;
      default: {
        // Inform user that synthesis is in progress
        const processingMessage = this.replyService.createProcessingReply();
        await sendReply(event.replyToken, [processingMessage]);
      }
    }
  }

  /**
   * Handle text messages while waiting for result check after character upload
   */
  private async handleAwaitingResultCharacterTextMessage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
    command: ParsedCommand,
    handlers: any,
    sendReply: (
      replyToken: string,
      messages: messagingApi.Message[],
    ) => Promise<void>,
  ): Promise<void> {
    switch (command.type) {
      case PassiveCommand.CHECK_RESULT:
        await handlers.checkSynthesisResult(event);
        break;
      case PassiveCommand.CLEAR_CHARACTER:
        await handlers.clearCharacterImage(event);
        await handlers.startPassiveFlow(event);
        break;
      case PassiveCommand.CLEAR_ALL:
        await handlers.handleClearAllCommand(event);
        break;
      case PassiveCommand.REGENERATE:
        await handlers.regenerateImage(event);
        break;
      case PassiveCommand.REUPLOAD_CHARACTER: {
        await handlers.clearCharacterImage(event);
        await this.userStateService.setUserState(
          event.userId,
          USER_STATES.PASSIVE_AWAITING_CHARACTER,
        );
        const characterMessage =
          this.replyService.createRequestReUploadCharacterReply();
        await sendReply(event.replyToken, [characterMessage]);
        break;
      }
      default: {
        const resultCheckMessage =
          this.replyService.createStillProcessingReply();
        await sendReply(event.replyToken, [resultCheckMessage]);
      }
    }
  }

  /**
   * Handle text messages while waiting for result check after clothing upload
   */
  private async handleAwaitingResultClothingTextMessage(
    event: FlowEvent & { type: "TEXT_MESSAGE" },
    command: ParsedCommand,
    handlers: any,
    sendReply: (
      replyToken: string,
      messages: messagingApi.Message[],
    ) => Promise<void>,
  ): Promise<void> {
    switch (command.type) {
      case PassiveCommand.CHECK_RESULT:
        await handlers.checkSynthesisResult(event);
        break;
      case PassiveCommand.CLEAR_CHARACTER:
        await handlers.clearCharacterImage(event);
        await handlers.startPassiveFlow(event);
        break;
      case PassiveCommand.CLEAR_CLOTHING:
        await handlers.clearClothingImage(event);
        await handlers.startPassiveFlow(event);
        break;
      case PassiveCommand.CLEAR_ALL:
        await handlers.handleClearAllCommand(event);
        break;
      case PassiveCommand.REGENERATE:
        await handlers.regenerateImage(event);
        break;
      case PassiveCommand.REUPLOAD_CHARACTER: {
        await handlers.clearCharacterImage(event);
        await this.userStateService.setUserState(
          event.userId,
          USER_STATES.PASSIVE_AWAITING_CHARACTER,
        );
        const characterMessage =
          this.replyService.createRequestReUploadCharacterReply();
        await sendReply(event.replyToken, [characterMessage]);
        break;
      }
      case PassiveCommand.REUPLOAD_CLOTHING: {
        await handlers.clearClothingImage(event);
        await this.userStateService.setUserState(
          event.userId,
          USER_STATES.PASSIVE_AWAITING_CLOTHING,
        );
        const clothingMessage =
          this.replyService.createRequestReUploadClothingReply();
        await sendReply(event.replyToken, [clothingMessage]);
        break;
      }
      default: {
        const resultCheckMessage =
          this.replyService.createStillProcessingReply();
        await sendReply(event.replyToken, [resultCheckMessage]);
      }
    }
  }
}

export default TextMessageHandlerService;
