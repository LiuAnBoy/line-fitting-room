import { ClientConfig, messagingApi } from "@line/bot-sdk";
import { Application } from "express";

import ConfigService from "../services/configService";
import ConsoleHandler from "../utils/consoleHandler";

/**
 * @class LineProvider
 * @description Manages the LINE Messaging API client and configuration.
 */
class LineProvider {
  private static instance: LineProvider;
  private messagingClient: messagingApi.MessagingApiClient;
  private config: ClientConfig;
  private logger: ConsoleHandler;

  /**
   * Private constructor for the Singleton pattern.
   * @private
   */
  private constructor() {
    this.logger = ConsoleHandler.getInstance("LineProvider");

    const configService = ConfigService.getInstance();
    const envConfig = configService.getConfig();

    this.config = {
      channelAccessToken: envConfig.LINE_CHANNEL_ACCESS_TOKEN,
      channelSecret: envConfig.LINE_CHANNEL_SECRET,
    };

    try {
      this.messagingClient = new messagingApi.MessagingApiClient(this.config);
    } catch (error) {
      this.logger.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Gets the singleton instance of the LineProvider.
   * @returns {LineProvider} The singleton instance.
   */
  public static getInstance(): LineProvider {
    if (!LineProvider.instance) {
      LineProvider.instance = new LineProvider();
    }
    return LineProvider.instance;
  }

  /**
   * Gets the LINE Messaging API client.
   * @returns {messagingApi.MessagingApiClient} The initialized client.
   */
  public getMessagingClient(): messagingApi.MessagingApiClient {
    return this.messagingClient;
  }

  /**
   * Gets the LINE Bot client configuration.
   * @returns {ClientConfig} The client configuration.
   */
  public getConfig(): ClientConfig {
    return this.config;
  }

  /**
   * Initializes the LINE provider.
   * In this context, it primarily validates the configuration.
   * @param {Application} _express - The Express application instance.
   * @returns {Application} The Express application instance.
   */
  public init(_express: Application): Application {
    if (!this.validateConfig()) {
      throw new Error("LINE configuration validation failed");
    }

    // Future LINE-related middleware could be added here,
    // e.g., a webhook signature validation middleware.

    this.logger.log("LINE provider initialized");
    return _express;
  }

  /**
   * Validates the essential LINE Bot configuration.
   * @returns {boolean} True if the configuration is valid, false otherwise.
   * @private
   */
  private validateConfig(): boolean {
    try {
      if (!this.config.channelAccessToken || !this.config.channelSecret) {
        throw new Error("Missing LINE channel access token or secret");
      }

      if (
        this.config.channelAccessToken.length === 0 ||
        this.config.channelSecret.length === 0
      ) {
        throw new Error("Empty LINE channel access token or secret");
      }

      this.logger.log("LINE configuration validated successfully");
      return true;
    } catch (error) {
      this.logger.handleError(error as Error);
      return false;
    }
  }
}

export default LineProvider;
