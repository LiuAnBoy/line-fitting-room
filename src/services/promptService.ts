import * as fs from "fs/promises";
import * as path from "path";

import consoleHandler from "../utils/consoleHandler";

/**
 * Prompt key enumeration
 * Corresponds to file names in the prompts/ folder (without extension)
 */
export enum PromptKey {
  IMAGE_SYNTHESIS = "image-synthesis",
  // Future prompts can be added here
  // ERROR_HANDLING = "error-handling",
  // USER_GUIDANCE = "user-guidance",
}

/**
 * Prompt file mapping
 * Defines the file name corresponding to each prompt
 */
const PROMPT_FILE_MAP: Record<PromptKey, string> = {
  [PromptKey.IMAGE_SYNTHESIS]: "image-synthesis.md",
};

/**
 * @class PromptService
 * @description AI prompt management service that loads all prompts at server startup
 */
class PromptService {
  private static instance: PromptService;
  private prompts: Map<PromptKey, string> = new Map();
  private logger = consoleHandler.getInstance("PromptService");
  private readonly promptsDir = path.join(process.cwd(), "src", "prompts");

  /**
   * Private constructor for the Singleton pattern.
   */
  private constructor() {}

  /**
   * Gets the singleton instance of the PromptService.
   * @returns {PromptService} The singleton instance.
   */
  public static getInstance(): PromptService {
    if (!PromptService.instance) {
      PromptService.instance = new PromptService();
    }
    return PromptService.instance;
  }

  /**
   * Initialize the prompt service and load all prompt files
   * @throws {Error} Throws error when file loading fails
   */
  public async initialize(): Promise<void> {
    this.logger.log("Starting to load AI prompt files...", { color: "blue" });

    try {
      // Check if prompts directory exists
      await fs.access(this.promptsDir);

      // Load all prompt files
      const loadPromises = Object.entries(PROMPT_FILE_MAP).map(
        async ([key, fileName]) => {
          const promptKey = key as PromptKey;
          const filePath = path.join(this.promptsDir, fileName);

          try {
            const content = await fs.readFile(filePath, "utf-8");
            const trimmedContent = content.trim();

            if (!trimmedContent) {
              throw new Error(`Prompt file is empty: ${fileName}`);
            }

            this.prompts.set(promptKey, trimmedContent);
            this.logger.log(`✅ Loaded prompt: ${promptKey}`, {
              color: "green",
            });
          } catch (error) {
            this.logger.error(
              `❌ Failed to load prompt: ${promptKey}`,
              error as Error,
            );
            throw new Error(
              `Failed to load prompt "${promptKey}" from file "${fileName}": ${
                (error as Error).message
              }`,
            );
          }
        },
      );

      await Promise.all(loadPromises);

      this.logger.log(
        `🎉 Successfully loaded ${this.prompts.size} prompt files`,
        {
          color: "green",
        },
      );
    } catch (error) {
      this.logger.error("Prompt service initialization failed", error as Error);

      if ((error as { code?: string }).code === "ENOENT") {
        throw new Error(`Prompts directory not found: ${this.promptsDir}`);
      }

      throw new Error(
        `PromptService initialization failed: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get the content of the specified prompt
   * @param {PromptKey} key - Prompt key
   * @returns {string} Prompt content
   * @throws {Error} Throws error when prompt does not exist
   */
  public getPrompt(key: PromptKey): string {
    const prompt = this.prompts.get(key);
    if (!prompt) {
      throw new Error(
        `Prompt not found: ${key}. Available prompts: ${this.getAvailablePrompts().join(", ")}`,
      );
    }
    return prompt;
  }

  /**
   * Check if prompt exists
   * @param {PromptKey} key - Prompt key
   * @returns {boolean} Whether it exists
   */
  public hasPrompt(key: PromptKey): boolean {
    return this.prompts.has(key);
  }

  /**
   * Get all available prompt keys
   * @returns {PromptKey[]} Array of prompt keys
   */
  public getAvailablePrompts(): PromptKey[] {
    return Array.from(this.prompts.keys());
  }

  /**
   * Get the number of loaded prompts
   * @returns {number} Number of prompts
   */
  public getPromptCount(): number {
    return this.prompts.size;
  }

  /**
   * Check if the prompt service has been initialized
   * @returns {boolean} Whether it has been initialized
   */
  public isInitialized(): boolean {
    return this.prompts.size > 0;
  }

  /**
   * Get prompt statistics
   * @returns {object} Statistics object
   */
  public getStats(): {
    totalPrompts: number;
    availableKeys: PromptKey[];
    promptsDirectory: string;
    initialized: boolean;
  } {
    return {
      totalPrompts: this.prompts.size,
      availableKeys: this.getAvailablePrompts(),
      promptsDirectory: this.promptsDir,
      initialized: this.isInitialized(),
    };
  }
}

export default PromptService;
