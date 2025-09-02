import { Redis } from "ioredis";

import RedisProvider from "../providers/redis";
import ConsoleHandler from "../utils/consoleHandler";

/**
 * Defines the possible states of a user in the conversation flow.
 */
// Centralized user states management
export const USER_STATES = {
  IDLE: "idle",
  WAITING_FOR_CHARACTER: "waiting_for_character",
  WAITING_FOR_CLOTHING: "waiting_for_clothing",
  WAITING_FOR_IMAGE_TYPE: "waiting_for_image_type",
  GENERATING_IMAGE: "generating_image",
} as const;

export type UserState = (typeof USER_STATES)[keyof typeof USER_STATES];

/**
 * Defines the structure for a pending image that awaits type confirmation.
 */
export type PendingImage = {
  imageId: string;
  timestamp: number;
};

/**
 * Defines the structure for synthesis result data.
 */
export type SynthesisResult = {
  status: "processing" | "completed" | "failed";
  imagePath?: string;
  errorMessage?: string;
  timestamp: number;
};

/**
 * @class UserStateService
 * @description Manages user states and operation locks in Redis with atomic operations.
 * Provides thread-safe state management and prevents concurrent operations.
 */
class UserStateService {
  private static instance: UserStateService;
  private logger = ConsoleHandler.getInstance("UserStateService");
  private redis: Redis;

  // Redis key prefixes
  private readonly STATE_PREFIX = "user:state:";
  private readonly LOCK_PREFIX = "user:lock:";
  private readonly PENDING_PREFIX = "user:pending:";

  // TTL configurations (in seconds)
  private readonly STATE_TIMEOUT = 30 * 60; // 30 minutes
  private readonly LOCK_TIMEOUT = 2 * 60; // 2 minutes for operation locks
  private readonly PENDING_TIMEOUT = 5 * 60; // 5 minutes for pending images

  /**
   * Private constructor for the Singleton pattern.
   * @private
   */
  private constructor() {
    this.redis = RedisProvider.getInstance().getClient();
    this.logger.log("UserStateService initialized");
  }

  /**
   * Gets the singleton instance of the UserStateService.
   * @returns {UserStateService} The singleton instance.
   */
  public static getInstance(): UserStateService {
    if (!UserStateService.instance) {
      UserStateService.instance = new UserStateService();
    }
    return UserStateService.instance;
  }

  // State Management Methods

  /**
   * Gets the Redis key for a user's state.
   * @param {string} userId - The user's ID.
   * @returns {string} The Redis key.
   * @private
   */
  private getStateKey(userId: string): string {
    return `${this.STATE_PREFIX}${userId}`;
  }

  /**
   * Sets a user's state in Redis with TTL.
   * @param {string} userId - The user's ID.
   * @param {UserState} state - The state to set.
   * @returns {Promise<void>}
   */
  public async setUserState(userId: string, state: UserState): Promise<void> {
    try {
      const key = this.getStateKey(userId);
      await this.redis.set(key, state, "EX", this.STATE_TIMEOUT);
      this.logger.log(`Set user state for ${userId}: ${state}`, {
        color: "blue",
      });
    } catch (error) {
      this.logger.handleError(error as Error);
      throw new Error(`Failed to set user state: ${(error as Error).message}`);
    }
  }

  /**
   * Gets a user's state from Redis.
   * @param {string} userId - The user's ID.
   * @returns {Promise<UserState>} The user's state, defaults to idle.
   */
  public async getUserState(userId: string): Promise<UserState> {
    try {
      const key = this.getStateKey(userId);
      const state = await this.redis.get(key);
      return (state as UserState) || USER_STATES.IDLE;
    } catch (error) {
      this.logger.handleError(error as Error);
      return USER_STATES.IDLE;
    }
  }

  /**
   * Clears a user's state from Redis.
   * @param {string} userId - The user's ID.
   * @returns {Promise<void>}
   */
  public async clearUserState(userId: string): Promise<void> {
    try {
      const key = this.getStateKey(userId);
      await this.redis.del(key);
      this.logger.log(`Cleared user state for ${userId}`, { color: "yellow" });
    } catch (error) {
      this.logger.handleError(error as Error);
      throw new Error(
        `Failed to clear user state: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Atomically transitions user state from expected current state to new state.
   * @param {string} userId - The user's ID.
   * @param {UserState} expectedState - The expected current state.
   * @param {UserState} newState - The new state to set.
   * @returns {Promise<boolean>} True if transition succeeded, false if state mismatch.
   */
  public async transitionUserState(
    userId: string,
    expectedState: UserState,
    newState: UserState,
  ): Promise<boolean> {
    try {
      const key = this.getStateKey(userId);

      // Use a Lua script for atomic state transition
      const luaScript = `
        local key = KEYS[1]
        local expected = ARGV[1]
        local newState = ARGV[2]
        local ttl = ARGV[3]
        
        local current = redis.call('GET', key)
        if current == false then
          current = 'idle'
        end
        
        if current == expected then
          redis.call('SET', key, newState, 'EX', ttl)
          return 1
        else
          return 0
        end
      `;

      const result = (await this.redis.eval(
        luaScript,
        1,
        key,
        expectedState,
        newState,
        this.STATE_TIMEOUT.toString(),
      )) as number;

      const success = result === 1;
      if (success) {
        this.logger.log(
          `State transition for ${userId}: ${expectedState} -> ${newState}`,
          { color: "blue" },
        );
      } else {
        this.logger.log(
          `State transition failed for ${userId}: expected ${expectedState}, but was different`,
          { color: "yellow" },
        );
      }

      return success;
    } catch (error) {
      this.logger.handleError(error as Error);
      throw new Error(
        `Failed to transition user state: ${(error as Error).message}`,
      );
    }
  }

  // Operation Lock Methods

  /**
   * Gets the Redis key for a user's operation lock.
   * @param {string} userId - The user's ID.
   * @returns {string} The Redis key.
   * @private
   */
  private getLockKey(userId: string): string {
    return `${this.LOCK_PREFIX}${userId}`;
  }

  /**
   * Attempts to acquire an operation lock for a user.
   * @param {string} userId - The user's ID.
   * @param {string} operation - Description of the operation being locked.
   * @returns {Promise<boolean>} True if lock acquired, false if already locked.
   */
  public async acquireLock(
    userId: string,
    operation: string = "operation",
  ): Promise<boolean> {
    try {
      const key = this.getLockKey(userId);

      // Use SET with NX (if not exists) and EX (expiry) for atomic lock acquisition
      const result = await this.redis.set(
        key,
        operation,
        "EX", // Set expiry first
        this.LOCK_TIMEOUT,
        "NX", // Only set if key doesn't exist
      );

      const acquired = result === "OK";
      if (acquired) {
        this.logger.log(`Lock acquired for ${userId}: ${operation}`, {
          color: "green",
        });
      } else {
        this.logger.log(
          `Lock acquisition failed for ${userId}: already locked`,
          {
            color: "yellow",
          },
        );
      }

      return acquired;
    } catch (error) {
      this.logger.handleError(error as Error);
      throw new Error(`Failed to acquire lock: ${(error as Error).message}`);
    }
  }

  /**
   * Releases an operation lock for a user.
   * @param {string} userId - The user's ID.
   * @returns {Promise<void>}
   */
  public async releaseLock(userId: string): Promise<void> {
    try {
      const key = this.getLockKey(userId);
      const result = await this.redis.del(key);

      if (result === 1) {
        this.logger.log(`Lock released for ${userId}`, { color: "green" });
      } else {
        this.logger.log(`No lock found to release for ${userId}`, {
          color: "yellow",
        });
      }
    } catch (error) {
      this.logger.handleError(error as Error);
      throw new Error(`Failed to release lock: ${(error as Error).message}`);
    }
  }

  /**
   * Checks if a user currently has an operation lock.
   * @param {string} userId - The user's ID.
   * @returns {Promise<{isLocked: boolean, operation?: string}>} Lock status and operation.
   */
  public async checkLock(userId: string): Promise<{
    isLocked: boolean;
    operation?: string;
  }> {
    try {
      const key = this.getLockKey(userId);
      const operation = await this.redis.get(key);

      return {
        isLocked: operation !== null,
        operation: operation || undefined,
      };
    } catch (error) {
      this.logger.handleError(error as Error);
      return { isLocked: false };
    }
  }

  /**
   * Executes an operation with automatic lock management.
   * @param {string} userId - The user's ID.
   * @param {string} operation - Description of the operation.
   * @param {() => Promise<T>} fn - The async function to execute.
   * @returns {Promise<{success: boolean, result?: T, error?: string}>} Operation result.
   */
  public async executeWithLock<T>(
    userId: string,
    operation: string,
    fn: () => Promise<T>,
  ): Promise<{
    success: boolean;
    result?: T;
    error?: string;
  }> {
    const lockAcquired = await this.acquireLock(userId, operation);

    if (!lockAcquired) {
      return {
        success: false,
        error: "Operation already in progress, please wait",
      };
    }

    try {
      const result = await fn();
      return {
        success: true,
        result,
      };
    } catch (error) {
      this.logger.handleError(error as Error);
      return {
        success: false,
        error: (error as Error).message,
      };
    } finally {
      await this.releaseLock(userId);
    }
  }

  // Pending Image Methods

  /**
   * Gets the Redis key for a user's pending image.
   * @param {string} userId - The user's ID.
   * @returns {string} The Redis key.
   * @private
   */
  private getPendingKey(userId: string): string {
    return `${this.PENDING_PREFIX}${userId}`;
  }

  /**
   * Stores a pending image for a user.
   * @param {string} userId - The user's ID.
   * @param {string} imageId - The image ID.
   * @returns {Promise<void>}
   */
  public async setPendingImage(userId: string, imageId: string): Promise<void> {
    try {
      const key = this.getPendingKey(userId);
      const pendingImage: PendingImage = {
        imageId,
        timestamp: Date.now(),
      };

      await this.redis.set(
        key,
        JSON.stringify(pendingImage),
        "EX",
        this.PENDING_TIMEOUT,
      );

      this.logger.log(`Set pending image for user ${userId}`, {
        color: "blue",
      });
    } catch (error) {
      this.logger.handleError(error as Error);
      throw new Error(
        `Failed to set pending image: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Gets a user's pending image.
   * @param {string} userId - The user's ID.
   * @returns {Promise<PendingImage | null>} The pending image or null.
   */
  public async getPendingImage(userId: string): Promise<PendingImage | null> {
    try {
      const key = this.getPendingKey(userId);
      const data = await this.redis.get(key);

      if (data) {
        return JSON.parse(data) as PendingImage;
      }
      return null;
    } catch (error) {
      this.logger.handleError(error as Error);
      return null;
    }
  }

  /**
   * Clears a user's pending image.
   * @param {string} userId - The user's ID.
   * @returns {Promise<void>}
   */
  public async clearPendingImage(userId: string): Promise<void> {
    try {
      const key = this.getPendingKey(userId);
      const result = await this.redis.del(key);

      if (result === 1) {
        this.logger.log(`Cleared pending image for user ${userId}`, {
          color: "yellow",
        });
      }
    } catch (error) {
      this.logger.handleError(error as Error);
      throw new Error(
        `Failed to clear pending image: ${(error as Error).message}`,
      );
    }
  }

  // Utility Methods

  /**
   * Clears all user data (state, locks, pending images).
   * @param {string} userId - The user's ID.
   * @returns {Promise<void>}
   */
  public async clearAllUserData(userId: string): Promise<void> {
    try {
      const keys = [
        this.getStateKey(userId),
        this.getLockKey(userId),
        this.getPendingKey(userId),
      ];

      const result = await this.redis.del(...keys);
      this.logger.log(
        `Cleared all data for user ${userId} (${result} keys deleted)`,
        {
          color: "red",
        },
      );
    } catch (error) {
      this.logger.handleError(error as Error);
      throw new Error(`Failed to clear user data: ${(error as Error).message}`);
    }
  }

  /**
   * Gets statistics about current user states and locks.
   * @returns {Promise<{totalStates: number, totalLocks: number, totalPending: number}>}
   */
  public async getStats(): Promise<{
    totalStates: number;
    totalLocks: number;
    totalPending: number;
  }> {
    try {
      const [stateKeys, lockKeys, pendingKeys] = await Promise.all([
        this.redis.keys(`${this.STATE_PREFIX}*`),
        this.redis.keys(`${this.LOCK_PREFIX}*`),
        this.redis.keys(`${this.PENDING_PREFIX}*`),
      ]);

      return {
        totalStates: stateKeys.length,
        totalLocks: lockKeys.length,
        totalPending: pendingKeys.length,
      };
    } catch (error) {
      this.logger.handleError(error as Error);
      return {
        totalStates: 0,
        totalLocks: 0,
        totalPending: 0,
      };
    }
  }

  /**
   * Sets the synthesis result for a user.
   * @param {string} userId - The user's ID.
   * @param {SynthesisResult} result - The synthesis result data.
   */
  public async setSynthesisResult(
    userId: string,
    result: SynthesisResult,
  ): Promise<void> {
    const key = `${this.STATE_PREFIX}synthesis_result:${userId}`;
    try {
      await this.redis.setex(key, this.RESULT_EXPIRY, JSON.stringify(result));
      this.logger.log(
        `Set synthesis result for user ${userId}: ${result.status}`,
      );
    } catch (error) {
      this.logger.handleError(error as Error);
      throw new Error(`Failed to set synthesis result: ${error}`);
    }
  }

  /**
   * Gets the synthesis result for a user.
   * @param {string} userId - The user's ID.
   * @returns {Promise<SynthesisResult | null>} The synthesis result or null if not found.
   */
  public async getSynthesisResult(
    userId: string,
  ): Promise<SynthesisResult | null> {
    const key = `${this.STATE_PREFIX}synthesis_result:${userId}`;
    try {
      const result = await this.redis.get(key);
      if (!result) return null;

      return JSON.parse(result) as SynthesisResult;
    } catch (error) {
      this.logger.handleError(error as Error);
      return null;
    }
  }

  /**
   * Clears the synthesis result for a user.
   * @param {string} userId - The user's ID.
   */
  public async clearSynthesisResult(userId: string): Promise<void> {
    const key = `${this.STATE_PREFIX}synthesis_result:${userId}`;
    try {
      await this.redis.del(key);
      this.logger.log(`Cleared synthesis result for user ${userId}`);
    } catch (error) {
      this.logger.handleError(error as Error);
    }
  }

  // Constants for synthesis result expiry (30 minutes)
  private readonly RESULT_EXPIRY = 1800;
}

export default UserStateService;
