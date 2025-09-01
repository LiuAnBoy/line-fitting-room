import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

import ConfigService from "../services/configService";
import ConsoleHandler from "../utils/consoleHandler";

/**
 * @class GeminiProvider
 * @description A provider class to interact with the Google Gemini API for image generation.
 */
class GeminiProvider {
  private readonly apiKey: string;
  private config: ConfigService;
  private logger: ConsoleHandler;
  private ai: GoogleGenAI;

  /**
   * @constructor
   */
  constructor() {
    this.config = ConfigService.getInstance();
    this.apiKey = this.config.getConfig().GEMINI_API_KEY;
    this.logger = ConsoleHandler.getInstance("GeminiProvider");
    this.ai = new GoogleGenAI({
      apiKey: this.apiKey,
    });
  }

  /**
   * Generates a new image by combining a character and a clothing image using the Gemini API.
   * @param {string} userId - The ID of the user for whom to generate the image.
   * @returns {Promise<string>} The file path of the newly generated image.
   */
  public async generateImagePhoto(userId: string): Promise<string> {
    // Read the character image and format it to Base64
    const { data: characterImageData } = await this.getImageData(
      userId,
      "character",
    );
    // Read the clothing image and format it to Base64
    const { data: clothingImageData } = await this.getImageData(
      userId,
      "clothing",
    );

    const prompt = `Replace the clothing on the person from the first image with the outfit from the second image. 
Keep the original background and environment from the character image unchanged. 
Ensure the new clothing fits naturally on the body with realistic fabric texture, folds, and correct perspective. 
Adjust lighting and shadows so the outfit matches the existing scene. 
The final photo should look like a professional, high-resolution fashion e-commerce image, 
with the person realistically wearing the clothing in the original background.`;

    // Generate the image photo
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

    const buffer = Buffer.from(imageData, "base64");

    const userImageDir = path.join(process.cwd(), "images", userId);

    try {
      await fs.promises.access(userImageDir);
    } catch {
      await fs.promises.mkdir(userImageDir, { recursive: true });
    }

    await this.cleanupOldGeneratedImages(userImageDir);

    // Generate a new filename using a timestamp.
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `generated_${timestamp}.jpg`;
    const filePath = path.join(userImageDir, filename);

    await fs.promises.writeFile(filePath, buffer);
    this.logger.log(`Generated image saved: ${filePath}`);

    return filePath;
  }

  /**
   * Reads an image file from the filesystem and returns its Base64 encoded data.
   * @param {string} userId - The user's ID.
   * @param {'character' | 'clothing'} type - The type of image to read.
   * @returns {Promise<{ data: string; fileName: string }>} An object containing the Base64 data and filename.
   * @private
   */
  private async getImageData(
    userId: string,
    type: "character" | "clothing",
  ): Promise<{ data: string; fileName: string }> {
    const imagePath = path.join(process.cwd(), "images", userId, `${type}.jpg`);
    const imageData = await fs.promises.readFile(imagePath);
    return {
      data: imageData.toString("base64"),
      fileName: `${type}.jpg`,
    };
  }

  /**
   * Deletes all previously generated images (files starting with 'generated_') in a user's directory.
   * @param {string} userImageDir - The absolute path to the user's image directory.
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
      // If the directory doesn't exist or there are other errors, log it but don't crash.
      this.logger.handleError(error as Error);
    }
  }
}

export default new GeminiProvider();
