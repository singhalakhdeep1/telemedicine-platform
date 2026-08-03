/**
 * Idempotency Service with Key Generation and Expiration
 * Ensures that duplicate requests with the same idempotency key
 * return the same response, preventing duplicate operations
 * Enhanced with key generation, expiration, and deduplication
 */

import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

export interface IdempotencyConfig {
  ttl?: number; // Time to live in seconds (default: 24 hours)
  keyPrefix?: string; // Prefix for idempotency keys
}

export interface IdempotencyResult {
  cached: boolean;
  response?: any;
  key: string;
  expiresAt: Date;
}

export interface IdempotencyKeyMetadata {
  key: string;
  userId?: string;
  operation: string;
  createdAt: Date;
  expiresAt: Date;
  responseHash?: string;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly redis: Redis;
  private readonly defaultTtl = 86400; // 24 hours
  private readonly keyPrefix = 'idempotency:';

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });

    this.startExpirationScheduler();
  }

  /**
   * Start expiration scheduler
   */
  private startExpirationScheduler(): void {
    // Clean up expired keys every hour
    setInterval(async () => {
      await this.cleanupExpiredKeys();
    }, 3600000);
  }

  /**
   * Cleanup expired keys
   */
  private async cleanupExpiredKeys(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      let cleanedCount = 0;

      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -2) {
          // Key exists but has no expiry, set default expiry
          await this.redis.expire(key, this.defaultTtl);
        } else if (ttl === -1) {
          // Key has no expiry, set it
          await this.redis.expire(key, this.defaultTtl);
        }
      }

      this.logger.log(`Checked ${keys.length} idempotency keys`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired keys:', error);
    }
  }

  /**
   * Generate idempotency key from request parameters
   */
  generateKey(operation: string, params: Record<string, any>, userId?: string): string {
    const keyParts = [
      this.keyPrefix,
      operation,
      userId || 'anonymous',
      this.hashParams(params),
    ];

    return keyParts.join(':');
  }

  /**
   * Hash parameters for key generation
   */
  private hashParams(params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {} as Record<string, any>);

    const paramString = JSON.stringify(sortedParams);
    return this.simpleHash(paramString);
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Check if request is idempotent (cached response exists)
   */
  async check(key: string, config?: IdempotencyConfig): Promise<IdempotencyResult> {
    const ttl = config?.ttl || this.defaultTtl;
    const fullKey = config?.keyPrefix 
      ? `${config.keyPrefix}:${key}`
      : `${this.keyPrefix}${key}`;

    try {
      const cached = await this.redis.get(fullKey);

      if (cached) {
        const response = JSON.parse(cached);
        const metadata = await this.getMetadata(fullKey);

        this.logger.debug(`Idempotency cache hit for key: ${fullKey}`);
        return {
          cached: true,
          response: response.data,
          key: fullKey,
          expiresAt: metadata?.expiresAt || new Date(Date.now() + ttl * 1000),
        };
      }

      this.logger.debug(`Idempotency cache miss for key: ${fullKey}`);
      return {
        cached: false,
        key: fullKey,
        expiresAt: new Date(Date.now() + ttl * 1000),
      };
    } catch (error) {
      this.logger.error(`Error checking idempotency for key ${fullKey}:`, error);
      return {
        cached: false,
        key: fullKey,
        expiresAt: new Date(Date.now() + ttl * 1000),
      };
    }
  }

  /**
   * Store response for idempotency
   */
  async store(
    key: string,
    response: any,
    config?: IdempotencyConfig,
    metadata?: Omit<IdempotencyKeyMetadata, 'key' | 'createdAt' | 'expiresAt'>,
  ): Promise<void> {
    const ttl = config?.ttl || this.defaultTtl;
    const fullKey = config?.keyPrefix 
      ? `${config.keyPrefix}:${key}`
      : `${this.keyPrefix}${key}`;

    try {
      const responseHash = this.simpleHash(JSON.stringify(response));
      const expiresAt = new Date(Date.now() + ttl * 1000);

      // Store response
      await this.redis.setex(
        fullKey,
        ttl,
        JSON.stringify({ data: response, hash: responseHash }),
      );

      // Store metadata
      const keyMetadata: IdempotencyKeyMetadata = {
        key: fullKey,
        createdAt: new Date(),
        expiresAt,
        responseHash,
        ...metadata,
      };

      await this.redis.setex(
        `${fullKey}:metadata`,
        ttl,
        JSON.stringify(keyMetadata),
      );

      this.logger.debug(`Stored idempotency response for key: ${fullKey}`);
    } catch (error) {
      this.logger.error(`Error storing idempotency for key ${fullKey}:`, error);
    }
  }

  /**
   * Get metadata for an idempotency key
   */
  async getMetadata(key: string): Promise<IdempotencyKeyMetadata | null> {
    try {
      const metadata = await this.redis.get(`${key}:metadata`);
      if (metadata) {
        return JSON.parse(metadata);
      }
      return null;
    } catch (error) {
      this.logger.error(`Error getting metadata for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete idempotency key
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      await this.redis.del(`${key}:metadata`);
      this.logger.debug(`Deleted idempotency key: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting idempotency key ${key}:`, error);
    }
  }

  /**
   * Check for duplicate keys (deduplication)
   */
  async checkDuplicate(operation: string, params: Record<string, any>, userId?: string): Promise<boolean> {
    const key = this.generateKey(operation, params, userId);
    const result = await this.check(key);
    return result.cached;
  }

  /**
   * Get all active idempotency keys for a user
   */
  async getUserKeys(userId: string): Promise<IdempotencyKeyMetadata[]> {
    try {
      const pattern = `${this.keyPrefix}*:${userId}:*`;
      const keys = await this.redis.keys(pattern);
      const metadataList: IdempotencyKeyMetadata[] = [];

      for (const key of keys) {
        const metadata = await this.getMetadata(key);
        if (metadata) {
          metadataList.push(metadata);
        }
      }

      return metadataList;
    } catch (error) {
      this.logger.error(`Error getting user keys for ${userId}:`, error);
      return [];
    }
  }

  /**
   * Invalidate all keys for a user
   */
  async invalidateUserKeys(userId: string): Promise<number> {
    try {
      const pattern = `${this.keyPrefix}*:${userId}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        // Also delete metadata keys
        const metadataKeys = keys.map(k => `${k}:metadata`);
        await this.redis.del(...metadataKeys);
      }

      this.logger.log(`Invalidated ${keys.length} keys for user ${userId}`);
      return keys.length;
    } catch (error) {
      this.logger.error(`Error invalidating user keys for ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Get idempotency statistics
   */
  async getStatistics(): Promise<{
    totalKeys: number;
    keysByUser: Record<string, number>;
    keysByOperation: Record<string, number>;
    averageTtl: number;
  }> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      const keysByUser: Record<string, number> = {};
      const keysByOperation: Record<string, number> = {};
      let totalTtl = 0;

      for (const key of keys) {
        const metadata = await this.getMetadata(key);
        if (metadata) {
          // Count by user
          const userId = metadata.userId || 'anonymous';
          keysByUser[userId] = (keysByUser[userId] || 0) + 1;

          // Count by operation
          const operation = metadata.operation;
          keysByOperation[operation] = (keysByOperation[operation] || 0) + 1;

          // Calculate TTL
          const ttl = await this.redis.ttl(key);
          totalTtl += ttl;
        }
      }

      const averageTtl = keys.length > 0 ? totalTtl / keys.length : 0;

      return {
        totalKeys: keys.length,
        keysByUser,
        keysByOperation,
        averageTtl,
      };
    } catch (error) {
      this.logger.error('Error getting idempotency statistics:', error);
      return {
        totalKeys: 0,
        keysByUser: {},
        keysByOperation: {},
        averageTtl: 0,
      };
    }
  }

  /**
   * Middleware helper: execute with idempotency
   */
  async executeWithIdempotency<T>(
    operation: string,
    params: Record<string, any>,
    executor: () => Promise<T>,
    config?: IdempotencyConfig,
    userId?: string,
  ): Promise<T> {
    const key = this.generateKey(operation, params, userId);
    const result = await this.check(key, config);

    if (result.cached && result.response) {
      this.logger.log(`Returning cached response for operation: ${operation}`);
      return result.response as T;
    }

    // Execute the operation
    const response = await executor();

    // Store the response
    await this.store(key, response, config, {
      operation,
      userId,
    });

    return response;
  }
}
