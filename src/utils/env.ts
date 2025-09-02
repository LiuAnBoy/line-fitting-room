/**
 * Enhanced environment variable validation with fail-fast mechanism
 * Uses Zod for strict validation and comprehensive error reporting
 * Implements early failure detection to prevent runtime issues
 */
import dotenv from "dotenv";
import * as fs from "fs";
import Redis from "ioredis";
import path from "path";
import { z } from "zod";

// Load environment variables from .env file before validation
dotenv.config();

// Enhanced validation schema with strict rules
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),

  // Server configuration with strict validation
  PORT: z.coerce
    .number()
    .int("PORT must be an integer")
    .min(1, "PORT must be positive")
    .max(65535, "PORT must be less than 65536")
    .default(8000),

  BASE_URL: z
    .string()
    .url("BASE_URL must be a valid URL")
    .refine((url) => !url.endsWith("/"), "BASE_URL should not end with /")
    .default("http://localhost:8000"),

  // LINE Bot configuration with enhanced validation
  LINE_CHANNEL_ACCESS_TOKEN: z
    .string()
    .min(100, "LINE_CHANNEL_ACCESS_TOKEN appears to be invalid (too short)")
    .regex(
      /^[a-zA-Z0-9+/=]+$/,
      "LINE_CHANNEL_ACCESS_TOKEN contains invalid characters",
    ),

  LINE_CHANNEL_SECRET: z
    .string()
    .min(32, "LINE_CHANNEL_SECRET appears to be invalid (too short)")
    .max(32, "LINE_CHANNEL_SECRET appears to be invalid (too long)")
    .regex(/^[a-f0-9]+$/, "LINE_CHANNEL_SECRET must be hexadecimal"),

  // Gemini API configuration
  GEMINI_API_KEY: z
    .string()
    .min(30, "GEMINI_API_KEY appears to be invalid (too short)")
    .regex(/^[a-zA-Z0-9_-]+$/, "GEMINI_API_KEY contains invalid characters"),

  // Redis configuration with URL validation
  REDIS_URL: z
    .string()
    .regex(/^redis:\/\//, "REDIS_URL must start with redis://")
    .default("redis://localhost:6379"),

  // Optional Redis configuration for fine-grained control
  REDIS_HOST: z.string().optional().default("localhost"),
  REDIS_PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .optional()
    .default(6379),
  REDIS_DB: z.coerce.number().int().min(0).max(15).optional().default(0),
  REDIS_PASSWORD: z.string().optional(),
});

// Type inference from schema
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validate environment configuration with comprehensive error reporting
 * Implements fail-fast mechanism to catch configuration issues early
 */
function validateEnvironment(): EnvConfig {
  try {
    // Parse and validate environment variables
    const config = envSchema.parse(process.env);

    // Additional runtime validations
    validateRuntimeConstraints(config);

    console.log("✅ Environment validation successful");
    return config;
  } catch (error) {
    console.error("❌ Environment validation failed:");

    if (error instanceof z.ZodError) {
      // Format Zod validation errors for better readability
      console.error("\nValidation errors:");
      error.issues.forEach((err) => {
        console.error(`  • ${err.path.join(".")}: ${err.message}`);
      });

      // Provide helpful suggestions
      console.error("\nSuggestions:");
      console.error(
        "  1. Check your .env file exists and is properly formatted",
      );
      console.error("  2. Ensure all required environment variables are set");
      console.error("  3. Verify API keys and tokens are valid");
    } else {
      console.error(error);
    }

    console.error(
      "\n💥 Application startup aborted due to invalid configuration",
    );
    process.exit(1); // Fail-fast mechanism
  }
}

/**
 * Additional runtime constraint validations
 * @param config - Validated environment configuration
 */
function validateRuntimeConstraints(config: EnvConfig): void {
  // Validate file system permissions for image storage
  const imageDir = path.join(process.cwd(), "images");
  try {
    fs.accessSync(imageDir, fs.constants.W_OK);
  } catch {
    // Try to create the directory if it doesn't exist
    try {
      fs.mkdirSync(imageDir, { recursive: true });
    } catch (createError) {
      throw new Error(
        `Cannot create or write to images directory: ${createError}`,
      );
    }
  }

  // Validate production environment requirements
  if (config.NODE_ENV === "production") {
    if (config.BASE_URL.includes("localhost")) {
      throw new Error(
        "Production environment should not use localhost in BASE_URL",
      );
    }

    if (config.PORT === 8000) {
      console.warn("⚠️  Using default port 8000 in production");
    }
  }

  // Validate Redis connection format
  if (
    config.REDIS_URL &&
    !config.REDIS_URL.match(/^redis:\/\/([^:]+):?(\d+)?\/?(\d+)?$/)
  ) {
    throw new Error(
      "REDIS_URL format is invalid. Expected format: redis://host:port/db",
    );
  }
}

/**
 * Health check for critical services configuration
 * @param config - Environment configuration
 * @returns Promise<boolean> - Health status
 */
export async function validateServicesHealth(
  config: EnvConfig,
): Promise<boolean> {
  const healthChecks: Promise<boolean>[] = [];

  // Redis connectivity check
  healthChecks.push(
    new Promise((resolve) => {
      const redis = new Redis(config.REDIS_URL);

      redis
        .ping()
        .then(() => {
          redis.disconnect();
          resolve(true);
        })
        .catch(() => resolve(false));

      // Timeout after 5 seconds
      setTimeout(() => {
        redis.disconnect();
        resolve(false);
      }, 5000);
    }),
  );

  const results = await Promise.all(healthChecks);
  return results.every((result) => result);
}

// Validate and export configuration
export const env = validateEnvironment();
export default env;
