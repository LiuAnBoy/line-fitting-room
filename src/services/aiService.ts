import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";

import consoleHandler from "../utils/consoleHandler";
import ConfigService from "./configService";
import ImageCacheService from "./imageCacheService";

/**
 * @class AIService
 * @description A unified AI image synthesis service responsible for handling all AI-related business logic
 */
class AIService {
  private static instance: AIService;
  private ai: GoogleGenAI;
  private config: ConfigService;
  private imageCacheService: ImageCacheService;
  private logger = consoleHandler.getInstance("AIService");

  /**
   * Private constructor for the Singleton pattern.
   */
  private constructor() {
    this.config = ConfigService.getInstance();
    this.ai = new GoogleGenAI({
      apiKey: this.config.getConfig().GEMINI_API_KEY,
    });
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
   * @param {string} userId - User ID
   * @returns {Promise<string>} Generated image file path
   */
  public async synthesizeImages(userId: string): Promise<string> {
    this.logger.log(`Starting image synthesis for user ${userId}`, {
      color: "blue",
    });

    try {
      // Get image paths from cache service
      const characterImagePath = await this.imageCacheService.getImagePath(
        userId,
        "character",
      );
      const clothingImagePath = await this.imageCacheService.getImagePath(
        userId,
        "clothing",
      );

      if (!characterImagePath || !clothingImagePath) {
        throw new Error("Required images not found for synthesis");
      }

      // Validate image paths
      await this.validateImagePaths(characterImagePath, clothingImagePath);

      // Read image data as base64
      const characterImageData =
        await this.imageCacheService.readImageAsBase64(characterImagePath);
      const clothingImageData =
        await this.imageCacheService.readImageAsBase64(clothingImagePath);

      // Use Gemini API for image synthesis
      const generatedImageData = await this.synthesizeImagesWithGemini(
        characterImageData,
        clothingImageData,
      );

      // Save generated image
      const generatedImagePath =
        await this.imageCacheService.saveGeneratedImage(
          generatedImageData,
          userId,
        );

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
   * Synthesize images using character and clothing image base64 data
   * @param {string} characterImageData - Base64 character image data
   * @param {string} clothingImageData - Base64 clothing image data
   * @returns {Promise<string>} Base64 encoded generated image data
   * @private
   */
  private async synthesizeImagesWithGemini(
    characterImageData: string,
    clothingImageData: string,
  ): Promise<string> {
    const prompt = `Replace the clothing on the person from the first image with the outfit from the second image. 
Keep the original background and environment from the character image unchanged. 
Ensure the new clothing fits naturally on the body with realistic fabric texture, folds, and correct perspective. 
Adjust lighting and shadows so the outfit matches the existing scene. 
The final photo should look like a professional, high-resolution fashion e-commerce image, 
with the person realistically wearing the clothing in the original background.`;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: characterImageData,
          },
        },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: clothingImageData,
          },
        },
        {
          text: prompt,
        },
      ],
    });

    const imageData =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!imageData) {
      throw new Error("No image data found from Gemini API");
    }

    return imageData;
  }

  /**
   * Check if AI service is available
   * @returns {Promise<boolean>} Service availability status
   */
  public async isServiceAvailable(): Promise<boolean> {
    try {
      const apiKey = this.config.getConfig().GEMINI_API_KEY;
      return Boolean(apiKey && apiKey.length > 0);
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
