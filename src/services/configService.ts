import express, { Application } from "express";

import ConsoleHandler from "../utils/consoleHandler";
import env, { EnvConfig } from "../utils/env";

/**
 * @class ConfigService
 * @description Manages application configuration by loading and validating environment variables.
 */
class ConfigService {
  private static instance: ConfigService;
  private readonly config: EnvConfig;
  private readonly logger: ConsoleHandler;

  /**
   * Private constructor for the Singleton pattern.
   * Uses pre-validated environment variables from the env module.
   * @private
   */
  private constructor() {
    this.logger = ConsoleHandler.getInstance("Configuration");

    try {
      // Environment variables are already validated by the env module
      this.config = env;
      this.logger.log(
        "Environment variables validated and loaded successfully",
      );
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Configuration failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Gets the singleton instance of the ConfigService.
   * @returns {ConfigService} The singleton instance.
   */
  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Returns the entire application configuration object.
   * @returns {EnvConfig} The application configuration.
   */
  public getConfig(): EnvConfig {
    return this.config;
  }

  /**
   * A static method to get a specific configuration value by its key.
   * @param {keyof EnvConfig} key - The key of the configuration value to retrieve.
   * @returns {string | number} The configuration value.
   */
  public static get(key: keyof EnvConfig): string | number {
    const instance = ConfigService.getInstance();
    const value = instance.getConfig()[key];
    if (value === undefined) {
      throw new Error(`Configuration key ${String(key)} is undefined`);
    }
    return value;
  }

  /**
   * Initializes Express middleware related to configuration.
   * This includes setting up a custom body parser for the LINE webhook to preserve the raw body.
   * @param {Application} _express - The Express application instance.
   * @returns {Application} The Express application instance with middleware applied.
   */
  public init(_express: Application): Application {
    // Custom body parser for the webhook to get the raw body for signature validation.
    _express.use("/webhook", (req, res, next) => {
      let data = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        data += chunk;
      });
      req.on("end", () => {
        try {
          req.body = data ? JSON.parse(data) : {};
          req.rawBody = data;
          next();
        } catch (e) {
          this.logger.error("Failed to parse webhook JSON body", e as Error);
          res.status(400).send("Invalid JSON body");
        }
      });
    });

    // Use the standard JSON parser for all other routes.
    _express.use((req, res, next) => {
      if (req.path !== "/webhook") {
        express.json()(req, res, next);
      } else {
        next();
      }
    });

    _express.locals.config = this.config;
    this.logger.log("Configuration mounted");
    return _express;
  }
}

export default ConfigService;
