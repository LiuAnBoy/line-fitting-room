import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

import ConfigService from "../services/configService";
import ConsoleHandler from "../utils/consoleHandler";

/**
 * @class GeminiProvider
 * @description Pure API client for Google Gemini API interactions
 */
class GeminiProvider {
  private static instance: GeminiProvider;
  private readonly apiKey: string;
  private config: ConfigService;
  private logger: ConsoleHandler;
  private ai: GoogleGenAI;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.config = ConfigService.getInstance();
    this.apiKey = this.config.getConfig().GEMINI_API_KEY;
    this.logger = ConsoleHandler.getInstance("GeminiProvider");
    this.ai = new GoogleGenAI({
      apiKey: this.apiKey,
    });
  }

  /**
   * Gets the singleton instance of the GeminiProvider
   * @returns {GeminiProvider} The singleton instance
   */
  public static getInstance(): GeminiProvider {
    if (!GeminiProvider.instance) {
      GeminiProvider.instance = new GeminiProvider();
    }
    return GeminiProvider.instance;
  }

  /**
   * Synthesize images using character and clothing image data
   * @param {string} characterImagePath - Path to character image file
   * @param {string} clothingImagePath - Path to clothing image file
   * @param {string} userId - User ID for generating output path
   * @returns {Promise<string>} The file path of the newly generated image
   */
  public async synthesizeImages(
    characterImagePath: string,
    clothingImagePath: string,
    userId: string,
  ): Promise<string> {
    // Read image files and convert to base64
    const characterImageData = await this.readImageAsBase64(characterImagePath);
    const clothingImageData = await this.readImageAsBase64(clothingImagePath);

    const prompt = `Replace the clothing on the person from the first image with the outfit from the second image. 
Keep the original background and environment from the character image unchanged. 
Ensure the new clothing fits naturally on the body with realistic fabric texture, folds, and correct perspective. 
Adjust lighting and shadows so the outfit matches the existing scene. 
The final photo should look like a professional, high-resolution fashion e-commerce image, 
with the person realistically wearing the clothing in the original background.`;

    // Call Gemini API for image generation
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

    // Save generated image to file system
    return await this.saveGeneratedImage(imageData, userId);
  }

  /**
   * Reads an image file and converts it to a base64 string.
   * @param {string} imagePath - Full path to the image file.
   * @returns {Promise<string>} Base64 encoded image data.
   * @private
   */
  private async readImageAsBase64(imagePath: string): Promise<string> {
    const imageData = await fs.promises.readFile(imagePath);
    return imageData.toString("base64");
  }

  /**
   * Save generated image data to file system
   * @param {string} imageData - Base64 image data from API
   * @param {string} userId - User ID for directory structure
   * @returns {Promise<string>} File path of saved image
   * @private
   */
  private async saveGeneratedImage(
    imageData: string,
    userId: string,
  ): Promise<string> {
    const buffer = Buffer.from(imageData, "base64");

    const userImageDir = path.join(process.cwd(), "images", userId);

    // Ensure user directory exists
    try {
      await fs.promises.access(userImageDir);
    } catch {
      await fs.promises.mkdir(userImageDir, { recursive: true });
    }

    // Clean up old generated images
    await this.cleanupOldGeneratedImages(userImageDir);

    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `generated_${timestamp}.jpg`;
    const filePath = path.join(userImageDir, filename);

    await fs.promises.writeFile(filePath, buffer);
    this.logger.log(`Generated image saved: ${filePath}`);

    return filePath;
  }

  /**
   * Clean up old generated images in user directory
   * @param {string} userImageDir - Absolute path to user's image directory
   * @private
   */
  private async cleanupOldGeneratedImages(userImageDir: string): Promise<void> {
    try {
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
    } catch (error) {
      // If directory doesn't exist or other errors, log but don't crash
      this.logger.handleError(error as Error);
    }
  }

  /**
   * Health check for Gemini API availability
   * @returns {Promise<boolean>} API availability status
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Simple API test - this would need actual implementation based on Gemini API docs
      // For now, just check if we have a valid API key
      return Boolean(this.apiKey && this.apiKey.length > 0);
    } catch (error) {
      this.logger.handleError(error as Error);
      return false;
    }
  }
}

export default GeminiProvider;
