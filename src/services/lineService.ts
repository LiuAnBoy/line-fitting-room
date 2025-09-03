import { WebhookEvent } from "@line/bot-sdk";
import * as crypto from "crypto";

import ConsoleHandler from "../utils/consoleHandler";
import ConfigService from "./configService";
import FlowManagerService, { FlowEvent } from "./flowManagerService";

/**
 * @class LineService
 * @description Pure webhook router - delegates all business logic to FlowManagerService
 */
class LineService {
  private static instance: LineService;
  private logger = ConsoleHandler.getInstance("LineService");
  private config: ConfigService;
  private flowManager: FlowManagerService;

  /**
   * Private constructor for the Singleton pattern.
   * @private
   */
  private constructor() {
    this.config = ConfigService.getInstance();
    this.flowManager = FlowManagerService.getInstance();
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
   * Validate LINE webhook signature
   * @param {string} signature - The X-Line-Signature header value
   * @param {string} body - The raw request body
   * @returns {Promise<boolean>} True if signature is valid
   */
  public async validateSignature(
    signature: string,
    body: string,
  ): Promise<boolean> {
    const channelSecret = this.config.getConfig().LINE_CHANNEL_SECRET;

    // Debug logging for troubleshooting
    this.logger.log(`Signature validation attempt:`, { color: "cyan" });
    this.logger.log(`- Received signature: ${signature}`, { color: "cyan" });
    this.logger.log(`- Body length: ${body.length}`, { color: "cyan" });
    this.logger.log(
      `- Channel secret configured: ${channelSecret ? "Yes" : "No"}`,
      { color: "cyan" },
    );
    this.logger.log(`- Channel secret length: ${channelSecret?.length || 0}`, {
      color: "cyan",
    });

    if (!channelSecret) {
      this.logger.log("❌ Channel secret is missing!", { color: "red" });
      return false;
    }

    const expectedSignature = crypto
      .createHmac("sha256", channelSecret)
      .update(body)
      .digest("base64");

    // LINE sends signature without SHA256= prefix
    this.logger.log(`- Expected signature: ${expectedSignature}`, {
      color: "cyan",
    });
    this.logger.log(`- Signatures match: ${signature === expectedSignature}`, {
      color: signature === expectedSignature ? "green" : "red",
    });

    return signature === expectedSignature;
  }

  /**
   * Process incoming webhook events
   * @param {WebhookEvent[]} events - Array of LINE webhook events to process
   * @returns {Promise<void>}
   */
  public async processWebhookEvents(events: WebhookEvent[]): Promise<void> {
    // Process events sequentially to maintain state consistency
    for (const event of events) {
      try {
        await this.processEvent(event);
      } catch (error) {
        this.logger.handleError(error as Error);
      }
    }
  }

  /**
   * Convert LINE webhook event to FlowEvent and delegate to FlowManager
   * @param {WebhookEvent} event - LINE webhook event to process
   * @returns {Promise<void>}
   * @private
   */
  private async processEvent(event: WebhookEvent): Promise<void> {
    const { source } = event;

    // Not all events have replyToken
    const replyToken = "replyToken" in event ? event.replyToken : "";

    // Extract user ID
    let userId: string;
    if (source.type === "user") {
      userId = source.userId;
    } else if (source.type === "group") {
      userId = source.groupId;
    } else if (source.type === "room") {
      userId = source.roomId;
    } else {
      this.logger.log("Unsupported source type", { color: "yellow" });
      return;
    }

    // Convert to FlowEvent based on event type
    let flowEvent: FlowEvent | null = null;

    switch (event.type) {
      case "follow":
        flowEvent = {
          type: "FOLLOW",
          userId,
          replyToken,
        };
        break;

      case "message":
        if (event.message.type === "text") {
          flowEvent = {
            type: "TEXT_MESSAGE",
            text: event.message.text,
            userId,
            replyToken,
          };
        } else if (event.message.type === "image") {
          flowEvent = {
            type: "IMAGE_MESSAGE",
            imageId: event.message.id,
            userId,
            replyToken,
          };
        } else {
          this.logger.log(`Unsupported message type: ${event.message.type}`, {
            color: "yellow",
          });
          return;
        }
        break;

      case "unfollow":
        // Clean up user data when user unfollows
        // Note: No replyToken available for unfollow events, so we can't send responses
        this.logger.log(`User ${userId} unfollowed`, { color: "cyan" });
        // Could add cleanup logic here if needed
        return;

      case "join":
        // Bot added to group/room
        this.logger.log(`Bot joined group/room: ${userId}`, { color: "cyan" });
        // Could add welcome logic for groups if needed
        return;

      case "leave":
        // Bot removed from group/room
        this.logger.log(`Bot left group/room: ${userId}`, { color: "cyan" });
        // Could add cleanup logic here if needed
        return;

      default:
        this.logger.log(`Unhandled event type: ${event.type}`, {
          color: "yellow",
        });
        return;
    }

    // Delegate to FlowManager if we have a valid FlowEvent
    if (flowEvent) {
      await this.flowManager.processEvent(flowEvent);
    }
  }
}

export default LineService;
