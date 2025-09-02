import * as fs from "fs";

import GeminiProvider from "../providers/gemini";
import consoleHandler from "../utils/consoleHandler";
import ImageCacheService from "./imageCacheService";

/**
 * @class AIService
 * @description A unified AI image synthesis service responsible for handling all AI-related business logic
 */
class AIService {
  private static instance: AIService;
  private geminiProvider: GeminiProvider;
  private imageCacheService: ImageCacheService;
  private logger = consoleHandler.getInstance("AIService");

  /**
   * Private constructor for the Singleton pattern.
   */
  private constructor() {
    this.geminiProvider = GeminiProvider.getInstance();
    this.imageCacheService = ImageCacheService.getInstance();
  }

  /**
   * Gets the singleton instance of the AIService.
   * @returns {AIService} The singleton instance.
   */
  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * Execute image synthesis with unified business logic
   * @param {string} characterImagePath - Character image file path
   * @param {string} clothingImagePath - Clothing image file path
   * @param {string} userId - User ID
   * @returns {Promise<string>} Generated image file path
   */
  public async synthesizeImages(
    characterImagePath: string,
    clothingImagePath: string,
    userId: string,
  ): Promise<string> {
    this.logger.log(`Starting image synthesis for user ${userId}`, {
      color: "blue",
    });

    try {
      // Validate if the input images exist
      await this.validateImagePaths(characterImagePath, clothingImagePath);

      // Use GeminiProvider for image synthesis
      const generatedImagePath = await this.geminiProvider.synthesizeImages(
        characterImagePath,
        clothingImagePath,
        userId,
      );

      // Update image cache
      this.imageCacheService.saveGeneratedImagePath(userId, generatedImagePath);

      this.logger.log(
        `Successfully synthesized image for user ${userId}: ${generatedImagePath}`,
        {
          color: "green",
        },
      );

      return generatedImagePath;
    } catch (error) {
      this.logger.error(
        `Image synthesis failed for user ${userId}:`,
        error as Error,
      );
      throw new Error(
        `Image synthesis failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Validate image paths are accessible
   * @param {string} characterImagePath - Character image file path
   * @param {string} clothingImagePath - Clothing image file path
   * @private
   */
  private async validateImagePaths(
    characterImagePath: string,
    clothingImagePath: string,
  ): Promise<void> {
    try {
      await fs.promises.access(characterImagePath);
      await fs.promises.access(clothingImagePath);
    } catch {
      throw new Error("圖片文件不存在或無法訪問");
    }
  }

  /**
   * Check if AI service is available
   * @returns {Promise<boolean>} Service availability status
   */
  public async isServiceAvailable(): Promise<boolean> {
    try {
      // 檢查 Gemini API 是否可用
      return await this.geminiProvider.healthCheck();
    } catch (error) {
      this.logger.error("AI service health check failed:", error as Error);
      return false;
    }
  }

  /**
   * Get AI service status information
   * @returns {Promise<object>} Service status information
   */
  public async getServiceStatus(): Promise<{
    available: boolean;
    provider: string;
    version: string;
  }> {
    const available = await this.isServiceAvailable();

    return {
      available,
      provider: "Gemini",
      version: "1.0.0",
    };
  }
}

export default AIService;
