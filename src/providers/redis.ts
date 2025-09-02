import Redis from "ioredis";

import ConfigService from "../services/configService";
import ConsoleHandler from "../utils/consoleHandler";

/**
 * @class RedisProvider
 * @description Manages Redis connection using ioredis with singleton pattern.
 * Provides centralized Redis client access across the application.
 */
class RedisProvider {
  private static instance: RedisProvider;
  private client: Redis;
  private logger: ConsoleHandler;
  private config: ConfigService;

  /**
   * Private constructor for the Singleton pattern.
   * @private
   */
  private constructor() {
    this.logger = ConsoleHandler.getInstance("Redis");
    this.config = ConfigService.getInstance();

    const redisUrl = this.config.getConfig().REDIS_URL;

    try {
      this.client = new Redis(redisUrl, {
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: false,
      });

      // Connection event handlers
      this.client.on("connect", () => {
        this.logger.log("Redis connection established", { color: "green" });
      });

      this.client.on("ready", () => {
        this.logger.log("Redis client ready", { color: "green" });
      });

      this.client.on("error", (error) => {
        this.logger.handleError(
          new Error(`Redis connection error: ${error.message}`),
        );
      });

      this.client.on("close", () => {
        this.logger.log("Redis connection closed", { color: "yellow" });
      });

      this.client.on("reconnecting", () => {
        this.logger.log("Redis reconnecting...", { color: "blue" });
      });

      // Test initial connection
      this.testConnection().catch((error) => {
        this.logger.handleError(
          new Error(`Initial Redis connection test failed: ${error.message}`),
        );
      });
    } catch (error) {
      this.logger.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Gets the singleton instance of the RedisProvider.
   * @returns {RedisProvider} The singleton instance.
   */
  public static getInstance(): RedisProvider {
    if (!RedisProvider.instance) {
      RedisProvider.instance = new RedisProvider();
    }
    return RedisProvider.instance;
  }

  /**
   * Gets the Redis client instance.
   * @returns {Redis} The Redis client instance.
   */
  public getClient(): Redis {
    return this.client;
  }

  /**
   * Tests the Redis connection by sending a ping command.
   * @returns {Promise<boolean>} True if connection is successful, false otherwise.
   */
  public async testConnection(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      this.logger.log(`Redis ping successful: ${result}`, { color: "green" });
      return result === "PONG";
    } catch (error) {
      this.logger.handleError(
        new Error(`Redis ping failed: ${(error as Error).message}`),
      );
      return false;
    }
  }

  /**
   * Gracefully closes the Redis connection.
   * @returns {Promise<void>}
   */
  public async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.log("Redis connection closed gracefully", { color: "green" });
    } catch (error) {
      this.logger.handleError(
        new Error(
          `Error closing Redis connection: ${(error as Error).message}`,
        ),
      );
    }
  }
}

export default RedisProvider;
