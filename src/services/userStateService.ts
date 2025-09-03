import { Redis } from "ioredis";

import RedisProvider from "../providers/redis";
import ConsoleHandler from "../utils/consoleHandler";

/**
 * Core state definitions for the refactored architecture
 */
export const USER_STATES = {
  IDLE: "idle",
  PASSIVE_AWAITING_CHARACTER: "passive_awaiting_character",
  PASSIVE_AWAITING_CLOTHING: "passive_awaiting_clothing",
  GENERATING_IMAGE: "generating_image",
  PASSIVE_AWAITING_RESULT_CHECK_CHARACTER:
    "passive_awaiting_result_check_character",
  PASSIVE_AWAITING_RESULT_CHECK_CLOTHING:
    "passive_awaiting_result_check_clothing",
  ACTIVE_AWAITING_IMAGE_TYPE: "active_awaiting_image_type", // For Phase 2
} as const;

export type UserState = (typeof USER_STATES)[keyof typeof USER_STATES];

/**
 * Pending image structure for multi-step flows
 */
export type PendingImage = {
  imageId: string;
  timestamp: number;
};

/**
 * Synthesis result structure
 */
export type SynthesisResult = {
  status: "processing" | "completed" | "failed";
  imagePath?: string;
  errorMessage?: string;
  timestamp: number;
};

/**
 * Operation result for atomic Redis operations
 */
export type OperationResult<T = boolean> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * @class UserStateService
 * @description Clean state management service for the refactored architecture
 */
class UserStateService {
  private static instance: UserStateService;
  private logger = ConsoleHandler.getInstance("UserStateService");
  private redis: Redis;

  // Redis index keys
  private static readonly ACTIVE_USERS_KEY = "active_users";

  // Redis key prefixes
  private readonly STATE_PREFIX = "user:state:";
  private readonly LOCK_PREFIX = "user:lock:";
  private readonly PENDING_PREFIX = "user:pending:";
  private readonly SYNTHESIS_PREFIX = "user:synthesis:";

  // TTL configurations
  private readonly LOCK_TTL = 120; // 2 minutes
  private readonly PENDING_TTL = 300; // 5 minutes
  private readonly SYNTHESIS_TTL = 1800; // 30 minutes

  private constructor() {
    this.redis = RedisProvider.getInstance().getClient();
  }

  public static getInstance(): UserStateService {
    if (!UserStateService.instance) {
      UserStateService.instance = new UserStateService();
    }
    return UserStateService.instance;
  }

  /**
   * Set user state with validation
   */
  public async setUserState(userId: string, state: UserState): Promise<void> {
    const key = `${this.STATE_PREFIX}${userId}`;

    // Use pipeline to set state and add to active users index
    const pipeline = this.redis.pipeline();
    pipeline.set(key, state, "EX", this.SYNTHESIS_TTL);
    pipeline.sadd(UserStateService.ACTIVE_USERS_KEY, userId);
    await pipeline.exec();

    this.logger.log(`State set: ${userId} -> ${state}`, { color: "blue" });
  }

  /**
   * Get current user state
   */
  public async getUserState(userId: string): Promise<UserState> {
    const key = `${this.STATE_PREFIX}${userId}`;
    const state = await this.redis.get(key);
    return (state as UserState) || USER_STATES.IDLE;
  }

  /**
   * Atomic state transition with validation
   */
  public async transitionUserState(
    userId: string,
    expectedState: UserState,
    newState: UserState,
  ): Promise<boolean> {
    const luaScript = `
      local key = KEYS[1]
      local expected = ARGV[1]
      local new_state = ARGV[2]
      local ttl = ARGV[3]
      
      local current = redis.call('GET', key)
      if current == expected or (current == false and expected == 'idle') then
        redis.call('SET', key, new_state, 'EX', ttl)
        return 1
      else
        return 0
      end
    `;

    const result = await this.redis.eval(
      luaScript,
      1,
      `${this.STATE_PREFIX}${userId}`,
      expectedState,
      newState,
      this.SYNTHESIS_TTL.toString(),
    );

    if (result === 1) {
      this.logger.log(
        `State transition: ${userId} ${expectedState} -> ${newState}`,
        {
          color: "green",
        },
      );
      return true;
    } else {
      this.logger.log(
        `State transition failed: ${userId} expected ${expectedState}`,
        {
          color: "yellow",
        },
      );
      return false;
    }
  }

  /**
   * Clear user state
   */
  public async clearUserState(userId: string): Promise<void> {
    const key = `${this.STATE_PREFIX}${userId}`;

    // Use pipeline to clear state and remove from active users index
    const pipeline = this.redis.pipeline();
    pipeline.del(key);
    pipeline.srem(UserStateService.ACTIVE_USERS_KEY, userId);
    await pipeline.exec();

    this.logger.log(`State cleared: ${userId}`, { color: "cyan" });
  }

  /**
   * Execute operation with distributed lock
   */
  public async executeWithLock<T>(
    userId: string,
    operation: string,
    fn: () => Promise<T>,
  ): Promise<OperationResult<T>> {
    const lockKey = `${this.LOCK_PREFIX}${userId}:${operation}`;

    try {
      // Acquire lock
      const lockAcquired = await this.redis.set(
        lockKey,
        Date.now().toString(),
        "PX",
        this.LOCK_TTL * 1000,
        "NX",
      );

      if (!lockAcquired) {
        return {
          success: false,
          error: "Operation in progress",
        };
      }

      // Execute operation
      const data = await fn();

      return {
        success: true,
        data,
      };
    } catch (error) {
      this.logger.handleError(error as Error);
      return {
        success: false,
        error: (error as Error).message,
      };
    } finally {
      // Release lock
      await this.redis.del(lockKey);
    }
  }

  /**
   * Pending image management
   */
  public async setPendingImage(userId: string, imageId: string): Promise<void> {
    const key = `${this.PENDING_PREFIX}${userId}`;
    const pendingImage: PendingImage = {
      imageId,
      timestamp: Date.now(),
    };
    await this.redis.set(
      key,
      JSON.stringify(pendingImage),
      "EX",
      this.PENDING_TTL,
    );
  }

  public async getPendingImage(userId: string): Promise<PendingImage | null> {
    const key = `${this.PENDING_PREFIX}${userId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  public async clearPendingImage(userId: string): Promise<void> {
    const key = `${this.PENDING_PREFIX}${userId}`;
    await this.redis.del(key);
  }

  /**
   * Synthesis result management
   */
  public async setSynthesisResult(
    userId: string,
    result: SynthesisResult,
  ): Promise<void> {
    const key = `${this.SYNTHESIS_PREFIX}${userId}`;
    await this.redis.set(key, JSON.stringify(result), "EX", this.SYNTHESIS_TTL);
  }

  public async getSynthesisResult(
    userId: string,
  ): Promise<SynthesisResult | null> {
    const key = `${this.SYNTHESIS_PREFIX}${userId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  public async clearSynthesisResult(userId: string): Promise<void> {
    const key = `${this.SYNTHESIS_PREFIX}${userId}`;
    await this.redis.del(key);
  }

  /**
   * Clean up all user data, optionally excluding specific patterns
   */
  public async clearAllUserData(
    userId: string,
    excludePatterns?: string[],
  ): Promise<void> {
    const pattern = `*${userId}*`;
    const keys = await this.scanKeys(pattern);

    let keysToDelete = keys;

    // Exclude specified patterns if provided
    if (excludePatterns && excludePatterns.length > 0) {
      keysToDelete = keys.filter((key) => {
        return !excludePatterns.some((excludePattern) =>
          key.includes(excludePattern),
        );
      });
    }

    if (keysToDelete.length > 0) {
      // Use pipeline to delete keys and remove user from active index
      const pipeline = this.redis.pipeline();
      pipeline.del(...keysToDelete);
      pipeline.srem(UserStateService.ACTIVE_USERS_KEY, userId);
      await pipeline.exec();

      this.logger.log(
        `Cleared ${keysToDelete.length} data entries for user ${userId}`,
        { color: "red" },
      );
    }
  }

  /**
   * Get all active users using Redis index instead of scanning
   * @returns {Promise<string[]>} Array of active user IDs
   */
  public async getActiveUsers(): Promise<string[]> {
    const startTime = Date.now();
    try {
      const users = await this.redis.smembers(
        UserStateService.ACTIVE_USERS_KEY,
      );
      const duration = Date.now() - startTime;
      this.logger.log(
        `Retrieved ${users.length} active users in ${duration}ms`,
        { color: "green" },
      );
      return users;
    } catch (error) {
      this.logger.handleError(error as Error);
      return [];
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
   * Monitor Redis operation performance
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
      if (duration > 100) {
        // Log slow operations (>100ms)
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

export default UserStateService;
