/**
 * This file defines the schema for environment variables using Zod.
 * It ensures that all required environment variables are present and correctly typed.
 * The parsed and validated environment variables are exported as a singleton object.
 */
import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env file before validation
dotenv.config();

// Defines the schema for the environment variables.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8000),
  BASE_URL: z.string().url().default("http://localhost:8000"),
  LINE_CHANNEL_ACCESS_TOKEN: z
    .string()
    .min(1, "LINE_CHANNEL_ACCESS_TOKEN is required"),
  LINE_CHANNEL_SECRET: z.string().min(1, "LINE_CHANNEL_SECRET is required"),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  REDIS_URL: z
    .string()
    .min(1, "REDIS_URL is required")
    .default("redis://localhost:6379"),
});

// Infers the type of the environment configuration from the schema.
export type EnvConfig = z.infer<typeof envSchema>;

// Parses and validates the environment variables from process.env.
export const env = envSchema.parse(process.env);

export default env;
