import axios from "axios";
import * as fs from "fs";
import { Redis } from "ioredis";
import * as path from "path";

import RedisProvider from "../providers/redis";
import ConsoleHandler from "../utils/consoleHandler";
import ConfigService from "./configService";

/**
 * @class ImageCacheService
 * @description Manages the caching of user images, both in-memory and on the filesystem.
 * Handles downloading, storing, retrieving, and clearing of images.
 */
class ImageCacheService {
  private static instance: ImageCacheService;
  private logger = ConsoleHandler.getInstance("ImageCacheService");
  private readonly CACHE_TIMEOUT = 30 * 60; // 30 minutes in seconds for Redis TTL
  private readonly IMAGES_DIR = path.join(process.cwd(), "images");
  private config: ConfigService;
  private redis: Redis;

  /**
   * Private constructor for the Singleton pattern.
   * @private
   */
  private constructor() {
    this.config = ConfigService.getInstance();
    this.redis = RedisProvider.getInstance().getClient();
    this.initialize();
  }

  /**
   * Initializes the service by ensuring the images directory exists.
   * @private
   */
  private async initialize(): Promise<void> {
    await this.ensureImagesDirectory();
    this.logger.log("ImageCacheService initialized with Redis");
  }

  /**
   * Ensures that the base directory for storing images exists.
   * @private
   */
  private async ensureImagesDirectory(): Promise<void> {
    try {
      await fs.promises.access(this.IMAGES_DIR);
    } catch {
      await fs.promises.mkdir(this.IMAGES_DIR, { recursive: true });
      this.logger.log(`Created images directory: ${this.IMAGES_DIR}`);
    }
  }

  /**
   * Gets the absolute path to a user's image directory.
   * @param {string} userId - The user's ID.
   * @returns {string} The absolute path to the user's directory.
   */
  private getUserImageDir(userId: string): string {
    return path.join(this.IMAGES_DIR, userId);
  }

  /**
   * Ensures that a specific user's image directory exists.
   * @param {string} userId - The user's ID.
   * @private
   */
  private async ensureUserDirectory(userId: string): Promise<void> {
    const userDir = this.getUserImageDir(userId);
    try {
      await fs.promises.access(userDir);
    } catch {
      await fs.promises.mkdir(userDir, { recursive: true });
      this.logger.log(`Created user directory: ${userDir}`);
    }
  }

  /**
   * Gets the Redis hash key for a user's images.
   * @param {string} userId - The user's ID.
   * @returns {string} The Redis hash key.
   * @private
   */
  private getUserImagesKey(userId: string): string {
    return `user:${userId}:images`;
  }

  /**
   * Gets the singleton instance of the ImageCacheService.
   * @returns {ImageCacheService} The singleton instance.
   */
  public static getInstance(): ImageCacheService {
    if (!ImageCacheService.instance) {
      ImageCacheService.instance = new ImageCacheService();
    }
    return ImageCacheService.instance;
  }

  /**
   * Downloads an image from a LINE content URL and saves it to the filesystem.
   * Stores the file path in Redis with automatic expiration.
   * @param {string} userId - The user's ID.
   * @param {string} imageId - The message ID of the image content.
   * @param {'character' | 'clothing'} type - The type of image to save.
   */
  public async saveImage(
    userId: string,
    imageId: string,
    type: "character" | "clothing",
  ): Promise<void> {
    try {
      const imageBuffer = await this.downloadImageFromLine(imageId);
      await this.ensureUserDirectory(userId);

      const filename = type === "character" ? "character.jpg" : "clothing.jpg";
      const filePath = path.join(this.getUserImageDir(userId), filename);

      await fs.promises.writeFile(filePath, imageBuffer);
      this.logger.log(`Saved ${type} image for user ${userId}: ${filePath}`);

      const redisKey = this.getUserImagesKey(userId);
      await this.redis.hset(redisKey, type, filePath);
      await this.redis.expire(redisKey, this.CACHE_TIMEOUT);

      this.logger.log(`Stored ${type} image path in Redis for user ${userId}`, {
        color: "green",
      });
    } catch (error) {
      this.logger.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Downloads image content from the LINE Messaging API.
   * @param {string} imageId - The message ID of the image content.
   * @returns {Promise<Buffer>} A buffer containing the image data.
   * @private
   */
  private async downloadImageFromLine(imageId: string): Promise<Buffer> {
    const lineConfig = this.config.getConfig();
    const url = `https://api-data.line.me/v2/bot/message/${imageId}/content`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${lineConfig.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      responseType: "arraybuffer",
    });

    return Buffer.from(response.data);
  }

  /**
   * Gets the file path for a user's image from Redis cache.
   * @param {string} userId - The user's ID.
   * @param {"character" | "clothing" | "generated"} type - The type of image to retrieve.
   * @returns {Promise<string | null>} The file path or null if not found.
   */
  public async getImagePath(
    userId: string,
    type: "character" | "clothing" | "generated",
  ): Promise<string | null> {
    try {
      const redisKey = this.getUserImagesKey(userId);
      const filePath = await this.redis.hget(redisKey, type);
      return filePath;
    } catch (error) {
      this.logger.handleError(error as Error);
      return null;
    }
  }

  /**
   * Clears a user's character image from the filesystem and Redis cache.
   * @param {string} userId - The user's ID.
   */
  public async clearCharacter(userId: string): Promise<void> {
    const filePath = await this.getImagePath(userId, "character");
    if (filePath) {
      try {
        await fs.promises.access(filePath);
        await fs.promises.unlink(filePath);
      } catch {
        this.logger.log(`Character image file not found: ${filePath}`);
      }
    }

    const redisKey = this.getUserImagesKey(userId);

    // Use pipeline for atomic Redis operations
    const pipeline = this.redis.pipeline();
    pipeline.hdel(redisKey, "character");
    pipeline.hkeys(redisKey);
    const results = await pipeline.exec();

    // Check if hash is empty and delete if needed
    const remainingImages = (results?.[1]?.[1] as string[]) || [];
    if (remainingImages.length === 0) {
      await this.redis.del(redisKey);
    }

    this.logger.log(`Cleared character image for user ${userId}`, {
      color: "yellow",
    });
  }

  /**
   * Clears a user's clothing image from the filesystem and Redis cache.
   * @param {string} userId - The user's ID.
   */
  public async clearClothing(userId: string): Promise<void> {
    const filePath = await this.getImagePath(userId, "clothing");
    if (filePath) {
      try {
        await fs.promises.access(filePath);
        await fs.promises.unlink(filePath);
      } catch {
        this.logger.log(`Clothing image file not found: ${filePath}`);
      }
    }

    const redisKey = this.getUserImagesKey(userId);

    // Use pipeline for atomic Redis operations
    const pipeline = this.redis.pipeline();
    pipeline.hdel(redisKey, "clothing");
    pipeline.hkeys(redisKey);
    const results = await pipeline.exec();

    // Check if hash is empty and delete if needed
    const remainingImages = (results?.[1]?.[1] as string[]) || [];
    if (remainingImages.length === 0) {
      await this.redis.del(redisKey);
    }

    this.logger.log(`Cleared clothing image for user ${userId}`, {
      color: "yellow",
    });
  }

  /**
   * Clears all cached data and files for a specific user.
   * @param {string} userId - The user's ID.
   */
  public async clearAll(userId: string): Promise<void> {
    const userDir = this.getUserImageDir(userId);
    try {
      await fs.promises.access(userDir);
      await fs.promises.rm(userDir, { recursive: true, force: true });
      this.logger.log(`Removed user directory: ${userDir}`);
    } catch {
      this.logger.log(`User directory not found: ${userDir}`);
    }

    const redisKey = this.getUserImagesKey(userId);
    await this.redis.del(redisKey);

    this.logger.log(`Cleared all cache data for user ${userId}`, {
      color: "red",
    });
  }

  /**
   * Checks if a user has a character image.
   * @param {string} userId - The user's ID.
   * @returns {Promise<boolean>} True if the image exists, false otherwise.
   */
  public async hasCharacter(userId: string): Promise<boolean> {
    try {
      const redisKey = this.getUserImagesKey(userId);
      const exists = await this.redis.hexists(redisKey, "character");
      return exists === 1;
    } catch (error) {
      this.logger.handleError(error as Error);
      return false;
    }
  }

  /**
   * Checks if a user has a clothing image.
   * @param {string} userId - The user's ID.
   * @returns {Promise<boolean>} True if the image exists, false otherwise.
   */
  public async hasClothing(userId: string): Promise<boolean> {
    try {
      const redisKey = this.getUserImagesKey(userId);
      const exists = await this.redis.hexists(redisKey, "clothing");
      return exists === 1;
    } catch (error) {
      this.logger.handleError(error as Error);
      return false;
    }
  }

  /**
   * Checks if a user has both a character and a clothing image.
   * @param {string} userId - The user's ID.
   * @returns {Promise<boolean>} True if both images exist, false otherwise.
   */
  public async hasBothImages(userId: string): Promise<boolean> {
    const hasCharacter = await this.hasCharacter(userId);
    const hasClothing = await this.hasClothing(userId);
    return hasCharacter && hasClothing;
  }

  /**
   * Checks if a user has a generated (synthesized) image.
   * @param {string} userId - The user's ID.
   * @returns {Promise<boolean>} True if the image exists, false otherwise.
   */
  public async hasGenerated(userId: string): Promise<boolean> {
    try {
      const redisKey = this.getUserImagesKey(userId);
      const exists = await this.redis.hexists(redisKey, "generated");
      return exists === 1;
    } catch (error) {
      this.logger.handleError(error as Error);
      return false;
    }
  }

  /**
   * Saves the file path of a newly generated image in Redis.
   * @param {string} userId - The user's ID.
   * @param {string} filePath - The absolute path to the generated image file.
   */
  public async saveGeneratedImagePath(
    userId: string,
    filePath: string,
  ): Promise<void> {
    try {
      const redisKey = this.getUserImagesKey(userId);
      await this.redis.hset(redisKey, "generated", filePath);
      await this.redis.expire(redisKey, this.CACHE_TIMEOUT);

      this.logger.log(
        `Generated image path saved for user ${userId}: ${filePath}`,
      );
    } catch (error) {
      this.logger.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Clears a user's generated image from the filesystem and cache.
   * @param {string} userId - The user's ID.
   */
  public async clearGenerated(userId: string): Promise<void> {
    const filePath = await this.getImagePath(userId, "generated");
    if (filePath) {
      try {
        await fs.promises.access(filePath);
        await fs.promises.unlink(filePath);
        this.logger.log(`Generated image file deleted: ${filePath}`);
      } catch (error) {
        this.logger.handleError(error as Error);
      }
    }

    const redisKey = this.getUserImagesKey(userId);
    // Use pipeline for atomic Redis operations
    const pipeline = this.redis.pipeline();
    pipeline.hdel(redisKey, "generated");
    pipeline.hkeys(redisKey);
    const results = await pipeline.exec();

    // Check if hash is empty and delete if needed
    const remainingImages = (results?.[1]?.[1] as string[]) || [];
    if (remainingImages.length === 0) {
      await this.redis.del(redisKey);
    }
  }

  /**
   * Converts a local image file path to a publicly accessible URL.
   * @param {string} userId - The user's ID.
   * @param {'character' | 'clothing' | 'generated'} type - The type of image URL to generate.
   * @returns {Promise<string | null>} The public URL, or null if the path doesn't exist.
   */
  public async getImageUrl(
    userId: string,
    type: "character" | "clothing" | "generated",
  ): Promise<string | null> {
    const filePath = await this.getImagePath(userId, type);
    if (!filePath) {
      return null;
    }

    const baseUrl = this.config.getConfig().BASE_URL || "http://localhost:8000";

    const relativePath = filePath.replace(
      path.join(process.cwd(), "images"),
      "",
    );

    const timestamp = Date.now();
    return `${baseUrl}/images${relativePath}?t=${timestamp}`;
  }

  /**
   * Reads an image file and converts it to a base64 string.
   * @param {string} imagePath - Full path to the image file.
   * @returns {Promise<string>} Base64 encoded image data.
   */
  public async readImageAsBase64(imagePath: string): Promise<string> {
    try {
      const imageData = await fs.promises.readFile(imagePath);
      return imageData.toString("base64");
    } catch (error) {
      this.logger.handleError(error as Error);
      throw new Error(`Failed to read image file: ${imagePath}`);
    }
  }

  /**
   * Save generated image data to file system and update Redis cache
   * @param {string} imageData - Base64 image data from API
   * @param {string} userId - User ID for directory structure
   * @returns {Promise<string>} File path of saved image
   */
  public async saveGeneratedImage(
    imageData: string,
    userId: string,
  ): Promise<string> {
    try {
      const buffer = Buffer.from(imageData, "base64");
      await this.ensureUserDirectory(userId);
      await this.cleanupOldGeneratedImages(userId);

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `generated_${timestamp}.jpg`;
      const filePath = path.join(this.getUserImageDir(userId), filename);

      await fs.promises.writeFile(filePath, buffer);
      this.logger.log(`Generated image saved: ${filePath}`);

      await this.saveGeneratedImagePath(userId, filePath);

      return filePath;
    } catch (error) {
      this.logger.handleError(error as Error);
      throw new Error(`Failed to save generated image for user ${userId}`);
    }
  }

  /**
   * Clean up old generated images in user directory
   * @param {string} userId - User ID for directory cleanup
   */
  public async cleanupOldGeneratedImages(userId: string): Promise<void> {
    try {
      const userImageDir = this.getUserImageDir(userId);
      await fs.promises.access(userImageDir);

      const files = await fs.promises.readdir(userImageDir);
      const generatedFiles = files.filter((file) =>
        file.startsWith("generated_"),
      );

      await Promise.all(
        generatedFiles.map(async (file) => {
          const filePath = path.join(userImageDir, file);
          await fs.promises.unlink(filePath);
          this.logger.log(`Deleted old generated image: ${filePath}`);
        }),
      );
    } catch {
      this.logger.log(`No old generated images to cleanup for user ${userId}`);
    }
  }

  /**
   * Gets current cache statistics for debugging purposes.
   * @returns {Promise<object>} An object containing cache statistics.
   */
  public async getStats(): Promise<{
    totalUserKeys: number;
    userKeys: string[];
  }> {
    try {
      const pattern = "user:*:images";
      const keys = await this.scanKeys(pattern);

      return {
        totalUserKeys: keys.length,
        userKeys: keys,
      };
    } catch (error) {
      this.logger.handleError(error as Error);
      return {
        totalUserKeys: 0,
        userKeys: [],
      };
    }
  }

  /**
   * Scans for Redis keys matching a pattern using SCAN instead of KEYS
   * to avoid blocking operations on large datasets
   * @param pattern - Redis pattern to match
   * @returns {Promise<string[]>} Array of matching keys
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const startTime = Date.now();
    const keys: string[] = [];
    const stream = this.redis.scanStream({
      match: pattern,
      count: 100, // Process in batches of 100
    });

    for await (const chunk of stream) {
      keys.push(...chunk);
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `SCAN operation found ${keys.length} keys in ${duration}ms`,
      { color: "blue" },
    );
    return keys;
  }

  /**
   * Monitor Redis operation performance for image cache operations
   * @param operation - Operation name for logging
   * @param fn - Function to execute and monitor
   * @returns {Promise<T>} Result of the operation
   */
  private async monitoredRedisOperation<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      if (duration > 50) {
        // Log slow operations (>50ms for image operations)
        this.logger.log(`SLOW Redis ${operation}: ${duration}ms`, {
          color: "yellow",
        });
      }
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.handleError(
        new Error(
          `Redis ${operation} failed after ${duration}ms: ${(error as Error).message}`,
        ),
      );
      throw error;
    }
  }
}

export default ImageCacheService;
