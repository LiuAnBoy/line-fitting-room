import { WebhookEvent } from "@line/bot-sdk";
import { Request, Response } from "express";

import LineService from "../services/lineService";
import ConsoleHandler from "../utils/consoleHandler";

/**
 * @class LineController
 * @description Handles incoming HTTP requests for LINE-related endpoints.
 */
class LineController {
  private lineService: LineService;
  private logger = ConsoleHandler.getInstance("LineController");

  /**
   * @constructor
   */
  constructor() {
    this.lineService = LineService.getInstance();
  }

  /**
   * Handles the main webhook endpoint for the LINE Bot.
   * It validates the request and passes the events to the LineService.
   * @param {Request} req - The Express request object.
   * @param {Response} res - The Express response object.
   */
  public webhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const signature = req.headers["x-line-signature"] as string;
      if (!signature) {
        this.logger.warn("Missing x-line-signature header");
        res.status(401).json({
          success: false,
          message: "Missing LINE signature",
        });
        return;
      }

      const body = req.rawBody || JSON.stringify(req.body);

      const isValidSignature = await this.lineService.validateSignature(
        signature,
        body,
      );
      if (!isValidSignature) {
        this.logger.warn("Invalid LINE signature");
        res.status(401).json({
          success: false,
          message: "Invalid signature",
        });
        return;
      }

      const events: WebhookEvent[] = req.body.events;
      if (!events || events.length === 0) {
        this.logger.warn("No events in webhook request");
        res.status(400).json({
          success: false,
          message: "No events to process",
        });
        return;
      }

      await this.lineService.processWebhookEvents(events);

      res.status(200).json({
        success: true,
        message: "Events processed successfully",
      });
    } catch (error) {
      this.logger.handleError(error as Error);
      res.status(500).json({
        success: false,
        message: "Webhook processing failed",
      });
    }
  };

  /**
   * A simple health check endpoint to confirm the bot is running.
   * @param {Request} req - The Express request object.
   * @param {Response} res - The Express response object.
   */
  public health = (req: Request, res: Response): void => {
    res.json({
      success: true,
      statusCode: 200,
      message: "LINE Bot is healthy",
    });
  };
}

export default new LineController();
