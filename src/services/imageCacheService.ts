import axios from "axios";
import * as fs from "fs";
import * as path from "path";

import ConsoleHandler from "../utils/consoleHandler";
import ConfigService from "./configService";

// Interface for a cached character item (legacy).
interface CharacterItem {
  character: string;
  clothing: string;
}

// Interface for the in-memory character map (legacy).
interface CharacterMap {
  [key: string]: CharacterItem;
}

/**
 * @class ImageCacheService
 * @description Manages the caching of user images, both in-memory and on the filesystem.
 * Handles downloading, storing, retrieving, and clearing of images.
 */
class ImageCacheService {
  private static instance: ImageCacheService;
  // In-memory cache for image IDs (legacy, for backward compatibility).
  private characterMap: CharacterMap = {};
  // In-memory map for storing file paths of images.
  private imagePathMap: Map<
    string,
    { character?: string; clothing?: string; generated?: string }
  > = new Map();
  // In-memory map for managing cache expiration timers.
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private logger = ConsoleHandler.getInstance("ImageCacheService");
  private readonly CACHE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly IMAGES_DIR = path.join(process.cwd(), "images");
  private config: ConfigService;

  /**
   * Private constructor for the Singleton pattern.
   * @private
   */
  private constructor() {
    this.config = ConfigService.getInstance();
    this.initialize();
  }

  /**
   * Initializes the service by ensuring the images directory exists and loading existing images.
   * @private
   */
  private async initialize(): Promise<void> {
    await this.ensureImagesDirectory();
    await this.loadExistingImages();
    this.logger.log("ImageCacheService initialized");
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
   * Loads existing images from the filesystem into the in-memory cache upon startup.
   * @private
   */
  private async loadExistingImages(): Promise<void> {
    try {
      try {
        await fs.promises.access(this.IMAGES_DIR);
      } catch {
        return; // The images directory doesn't exist, nothing to load.
      }

      const dirents = await fs.promises.readdir(this.IMAGES_DIR, {
        withFileTypes: true,
      });
      const userDirectories = dirents
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      let totalLoadedImages = 0;

      for (const userId of userDirectories) {
        const userImageDir = this.getUserImageDir(userId);

        try {
          await fs.promises.access(userImageDir);
        } catch {
          continue;
        }

        const userPaths: {
          character?: string;
          clothing?: string;
          generated?: string;
        } = {};

        const characterImagePath = path.join(userImageDir, "character.jpg");
        const clothingImagePath = path.join(userImageDir, "clothing.jpg");

        try {
          await fs.promises.access(characterImagePath);
          userPaths.character = characterImagePath;
          totalLoadedImages++;
        } catch {
          // File doesn't exist, continue
        }

        try {
          await fs.promises.access(clothingImagePath);
          userPaths.clothing = clothingImagePath;
          totalLoadedImages++;
        } catch {
          // File doesn't exist, continue
        }

        const files = await fs.promises.readdir(userImageDir);
        const generatedFiles = files.filter(
          (file) => file.startsWith("generated_") && file.endsWith(".jpg"),
        );

        if (generatedFiles.length > 0) {
          generatedFiles.sort((a, b) => b.localeCompare(a));
          const latestGenerated = generatedFiles[0];
          userPaths.generated = path.join(userImageDir, latestGenerated);
          totalLoadedImages++;
        }

        if (userPaths.character || userPaths.clothing || userPaths.generated) {
          this.imagePathMap.set(userId, userPaths);

          // Maintain backward compatibility with the legacy in-memory cache.
          this.characterMap[userId] = {
            character: userPaths.character ? `cached_${userId}_character` : "",
            clothing: userPaths.clothing ? `cached_${userId}_clothing` : "",
          };
        }
      }

      this.logger.log(
        `Loaded ${totalLoadedImages} existing images from ${userDirectories.length} user directories`,
        { color: "green" },
      );
    } catch (error) {
      this.logger.handleError(error as Error);
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

      if (!this.imagePathMap.has(userId)) {
        this.imagePathMap.set(userId, {});
      }
      const userPaths = this.imagePathMap.get(userId)!;
      userPaths[type] = filePath;

      // Also save to the legacy in-memory cache for backward compatibility.
      this.set(userId, imageId, type);
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
   * Gets the file path for a specific type of image for a user.
   * @param {string} userId - The user's ID.
   * @param {'character' | 'clothing' | 'generated'} type - The type of image path to get.
   * @returns {string | null} The file path, or null if not found.
   */
  public getImagePath(
    userId: string,
    type: "character" | "clothing" | "generated",
  ): string | null {
    const userPaths = this.imagePathMap.get(userId);
    return userPaths?.[type] || null;
  }

  /**
   * Sets an image ID in the legacy in-memory cache and resets the expiration timer.
   * @param {string} userId - The user's ID.
   * @param {string} imageId - The image ID to cache.
   * @param {'character' | 'clothing'} type - The type of image.
   */
  public set(
    userId: string,
    imageId: string,
    type: "character" | "clothing",
  ): void {
    try {
      if (!this.characterMap[userId]) {
        this.characterMap[userId] = { character: "", clothing: "" };
      }

      const existingTimer = this.timers.get(userId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      this.characterMap[userId][type] = imageId;

      const timer = setTimeout(() => {
        this.clearAll(userId);
        this.logger.log(`Auto-cleared cache for user ${userId} after timeout`, {
          color: "yellow",
        });
      }, this.CACHE_TIMEOUT);

      this.timers.set(userId, timer);

      this.logger.log(`Set ${type} image for user ${userId}`, {
        color: "green",
      });
    } catch (error) {
      this.logger.error(
        `Failed to set ${type} image for user ${userId}:`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Gets cached data for a user from the legacy in-memory cache.
   * @param {string} userId - The user's ID.
   * @returns {CharacterItem | undefined} The cached data, or undefined if not found.
   */
  public get(userId: string): CharacterItem | undefined {
    return this.characterMap[userId];
  }

  /**
   * Clears a user's character image from the filesystem and cache.
   * @param {string} userId - The user's ID.
   */
  public async clearCharacter(userId: string): Promise<void> {
    const userPaths = this.imagePathMap.get(userId);
    if (userPaths?.character) {
      try {
        await fs.promises.access(userPaths.character);
        await fs.promises.unlink(userPaths.character);
      } catch {
        // File doesn't exist, continue
      }
      delete userPaths.character;
    }

    if (this.characterMap[userId]) {
      this.characterMap[userId].character = "";
      this.logger.log(`Cleared character image for user ${userId}`, {
        color: "yellow",
      });

      if (
        !this.characterMap[userId].character &&
        !this.characterMap[userId].clothing
      ) {
        await this.clearAll(userId);
      }
    }
  }

  /**
   * Clears a user's clothing image from the filesystem and cache.
   * @param {string} userId - The user's ID.
   */
  public async clearClothing(userId: string): Promise<void> {
    const userPaths = this.imagePathMap.get(userId);
    if (userPaths?.clothing) {
      try {
        await fs.promises.access(userPaths.clothing);
        await fs.promises.unlink(userPaths.clothing);
      } catch {
        // File doesn't exist, continue
      }
      delete userPaths.clothing;
    }

    if (this.characterMap[userId]) {
      this.characterMap[userId].clothing = "";
      this.logger.log(`Cleared clothing image for user ${userId}`, {
        color: "yellow",
      });

      if (
        !this.characterMap[userId].character &&
        !this.characterMap[userId].clothing
      ) {
        await this.clearAll(userId);
      }
    }
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
      // Directory doesn't exist, continue
    }

    this.imagePathMap.delete(userId);

    const timer = this.timers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(userId);
    }

    if (this.characterMap[userId]) {
      delete this.characterMap[userId];
      this.logger.log(`Cleared all cache data for user ${userId}`, {
        color: "red",
      });
    }
  }

  /**
   * Checks if a user has a character image.
   * @param {string} userId - The user's ID.
   * @returns {Promise<boolean>} True if the image exists, false otherwise.
   */
  public async hasCharacter(userId: string): Promise<boolean> {
    const filePath = this.getImagePath(userId, "character");
    if (filePath) {
      try {
        await fs.promises.access(filePath);
        return true;
      } catch {
        // File doesn't exist, fall through to legacy check
      }
    }

    const data = this.characterMap[userId];
    return !!(data && data.character);
  }

  /**
   * Checks if a user has a clothing image.
   * @param {string} userId - The user's ID.
   * @returns {Promise<boolean>} True if the image exists, false otherwise.
   */
  public async hasClothing(userId: string): Promise<boolean> {
    const filePath = this.getImagePath(userId, "clothing");
    if (filePath) {
      try {
        await fs.promises.access(filePath);
        return true;
      } catch {
        // File doesn't exist, fall through to legacy check
      }
    }

    const data = this.characterMap[userId];
    return !!(data && data.clothing);
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
    const filePath = this.getImagePath(userId, "generated");
    if (filePath) {
      try {
        await fs.promises.access(filePath);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Saves the file path of a newly generated image.
   * @param {string} userId - The user's ID.
   * @param {string} filePath - The absolute path to the generated image file.
   */
  public saveGeneratedImagePath(userId: string, filePath: string): void {
    if (!this.imagePathMap.has(userId)) {
      this.imagePathMap.set(userId, {});
    }
    const userPaths = this.imagePathMap.get(userId)!;
    userPaths.generated = filePath;

    this.logger.log(
      `Generated image path saved for user ${userId}: ${filePath}`,
    );

    this.resetTimer(userId);
  }

  /**
   * Clears a user's generated image from the filesystem and cache.
   * @param {string} userId - The user's ID.
   */
  public async clearGenerated(userId: string): Promise<void> {
    const filePath = this.getImagePath(userId, "generated");
    if (filePath) {
      try {
        await fs.promises.access(filePath);
        await fs.promises.unlink(filePath);
        this.logger.log(`Generated image file deleted: ${filePath}`);
      } catch (error) {
        this.logger.handleError(error as Error);
      }
    }

    const userPaths = this.imagePathMap.get(userId);
    if (userPaths) {
      delete userPaths.generated;
    }
  }

  /**
   * Resets the cache expiration timer for a user.
   * @param {string} userId - The user's ID.
   * @private
   */
  private resetTimer(userId: string): void {
    const existingTimer = this.timers.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.clearAll(userId);
      this.logger.log(`Auto-cleared cache for user ${userId} after timeout`, {
        color: "yellow",
      });
    }, this.CACHE_TIMEOUT);

    this.timers.set(userId, timer);
    this.logger.log(`Reset timer for user ${userId}`, { color: "blue" });
  }

  /**
   * Converts a local image file path to a publicly accessible URL.
   * @param {string} userId - The user's ID.
   * @param {'character' | 'clothing' | 'generated'} type - The type of image URL to generate.
   * @returns {string | null} The public URL, or null if the path doesn't exist.
   */
  public getImageUrl(
    userId: string,
    type: "character" | "clothing" | "generated",
  ): string | null {
    const filePath = this.getImagePath(userId, type);
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
   * Manually triggers a reload of existing images from the filesystem.
   */
  public async reloadExistingImages(): Promise<void> {
    this.logger.log("Manually reloading existing images...", {
      color: "yellow",
    });
    await this.loadExistingImages();
  }

  /**
   * Gets current cache statistics for debugging purposes.
   * @returns {object} An object containing cache statistics.
   */
  public getStats(): {
    totalUsers: number;
    users: string[];
    imagePathMapSize: number;
    imagePathUsers: string[];
  } {
    return {
      totalUsers: Object.keys(this.characterMap).length,
      users: Object.keys(this.characterMap),
      imagePathMapSize: this.imagePathMap.size,
      imagePathUsers: Array.from(this.imagePathMap.keys()),
    };
  }
}

export default ImageCacheService;
