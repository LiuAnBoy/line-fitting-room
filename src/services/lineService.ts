import {
  FollowEvent,
  ImageEventMessage,
  MessageEvent,
  messagingApi,
  WebhookEvent,
} from "@line/bot-sdk";
import * as crypto from "crypto";

import LineProvider from "../providers/line";
import ConsoleHandler from "../utils/consoleHandler";
import CommandService from "./commandService";
import ConfigService from "./configService";
import ImageCacheService from "./imageCacheService";
import ReplyService from "./replyService";
import { USER_STATES } from "./userStateService";

/**
 * @class LineService
 * @description Main service for handling LINE webhook events.
 * It validates signatures and dispatches events to appropriate handlers.
 */
class LineService {
  private static instance: LineService;
  private lineProvider: LineProvider;
  private imageCacheService: ImageCacheService;
  private replyService: ReplyService;
  private commandService: CommandService;
  private logger = ConsoleHandler.getInstance("LineService");
  private config: ConfigService;

  /**
   * Private constructor for the Singleton pattern.
   * @private
   */
  private constructor() {
    this.lineProvider = LineProvider.getInstance();
    this.imageCacheService = ImageCacheService.getInstance();
    this.replyService = ReplyService.getInstance();
    this.config = ConfigService.getInstance();
    this.commandService = CommandService.getInstance();
  }

  /**
   * Gets the singleton instance of the LineService.
   * @returns {LineService} The singleton instance.
   */
  public static getInstance(): LineService {
    if (!LineService.instance) {
      LineService.instance = new LineService();
    }
    return LineService.instance;
  }

  /**
   * Validates the webhook signature from LINE.
   * @param {string} signature - The value of the 'x-line-signature' header.
   * @param {string} body - The raw request body as a string.
   * @returns {Promise<boolean>} True if the signature is valid, false otherwise.
   */
  public async validateSignature(
    signature: string,
    body: string,
  ): Promise<boolean> {
    try {
      const channelSecret = this.config.getConfig().LINE_CHANNEL_SECRET;
      const hash = crypto
        .createHmac("SHA256", channelSecret)
        .update(body)
        .digest("base64");

      return hash === signature;
    } catch (error) {
      this.logger.handleError(error as Error);
      return false;
    }
  }

  /**
   * Processes an array of webhook events from a single request.
   * @param {WebhookEvent[]} events - The array of events from the webhook.
   */
  public async processWebhookEvents(events: WebhookEvent[]): Promise<void> {
    await Promise.all(events.map((event) => this.handleEvent(event)));
  }

  /**
   * Routes a single webhook event to the appropriate handler based on its type.
   * @param {WebhookEvent} event - The event to handle.
   * @private
   */
  private async handleEvent(event: WebhookEvent): Promise<void> {
    this.logger.log(`Processing event: ${event.type}`, { color: "blue" });

    switch (event.type) {
      case "message":
        await this.handleMessageEvent(event);
        break;
      case "follow":
        await this.handleFollowEvent(event);
        break;
      case "unfollow":
        await this.handleUnfollowEvent(event);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`, {
          color: "yellow",
        });
    }
  }

  /**
   * Handles message events, dispatching to text or image handlers.
   * @param {MessageEvent} event - The message event.
   * @private
   */
  private async handleMessageEvent(event: MessageEvent): Promise<void> {
    const userId = event.source.userId as string;

    try {
      if (event.message.type === "text") {
        await this.handleTextMessage(
          userId as string,
          event.message.text,
          event.replyToken,
        );
      } else if (event.message.type === "image") {
        await this.handleImageMessage(userId, event.message, event.replyToken);
      } else {
        // Handle unsupported message types.
        const replyMessage = this.replyService.createErrorMessage(
          "Unsupported message type. Please send text or an image.",
        );
        await this.sendReply(event.replyToken, [replyMessage]);
      }
    } catch (error) {
      this.logger.handleError(error as Error);
      const errorMessage = this.replyService.createErrorMessage();
      await this.sendReply(event.replyToken, [errorMessage]);
    }
  }

  /**
   * Delegates text message handling to the CommandService.
   * @private
   */
  private async handleTextMessage(
    userId: string,
    text: string,
    replyToken: string,
  ): Promise<void> {
    this.logger.log(`Text message from ${userId}: ${text}`, { color: "cyan" });
    await this.commandService.handleCommand(userId, text, replyToken);
  }

  /**
   * Handles incoming image messages based on the current user state.
   * @private
   */
  private async handleImageMessage(
    userId: string,
    message: ImageEventMessage,
    replyToken: string,
  ): Promise<void> {
    const imageId = message.id;

    this.logger.log(`Image message from ${userId}`, {
      color: "cyan",
    });

    // Delegate to CommandService which now handles all state management
    await this.commandService.handleImageMessage(userId, imageId, replyToken);
  }

  /**
   * Sends a reply message using the LINE Messaging API.
   * @private
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

  /**
   * Handles the 'follow' event when a user adds the bot.
   * @param {FollowEvent} event - The follow event.
   * @private
   */
  private async handleFollowEvent(event: FollowEvent): Promise<void> {
    const userId = event.source?.userId;
    this.logger.log(`User ${userId} followed the bot`, { color: "green" });

    if (event.replyToken && userId) {
      await this.commandService.setUserState(userId, USER_STATES.IDLE);
      const welcomeMessage = this.replyService.createWelcomeMessage();
      await this.sendReply(event.replyToken, [welcomeMessage]);
    }
  }

  /**
   * Handles the 'unfollow' event and cleans up user data.
   * @param {WebhookEvent} event - The unfollow event.
   * @private
   */
  private async handleUnfollowEvent(event: WebhookEvent): Promise<void> {
    const userId = event.source?.userId;
    if (userId) {
      await this.commandService.clearUserState(userId);
      await this.commandService.clearPendingImage(userId);
      await this.imageCacheService.clearAll(userId);
      this.logger.log(`User ${userId} unfollowed the bot and data cleared`, {
        color: "yellow",
      });
    }
  }
}

export default LineService;
