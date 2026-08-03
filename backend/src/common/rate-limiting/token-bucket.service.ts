/**
 * Rate Limiter with Multiple Algorithms
 * Implements Token Bucket and Sliding Window algorithms for API rate limiting
 * Used for appointment booking and other critical operations
 * Enhanced with distributed rate limiting and analytics
 */

import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

export enum RateLimitAlgorithm {
  TOKEN_BUCKET = 'TOKEN_BUCKET',
  SLIDING_WINDOW = 'SLIDING_WINDOW',
  FIXED_WINDOW = 'FIXED_WINDOW',
}

interface TokenBucketConfig {
  capacity: number;      // Maximum tokens in bucket
  refillRate: number;    // Tokens per second
  windowSize: number;    // Time window in seconds
}

interface SlidingWindowConfig {
  windowSize: number;    // Time window in seconds
  maxRequests: number;   // Maximum requests in window
  precision: number;     // Number of sub-windows for precision
}

interface FixedWindowConfig {
  windowSize: number;    // Time window in seconds
  maxRequests: number;   // Maximum requests in window
}

interface RateLimitResult {
  allowed: boolean;
  remainingTokens: number;
  resetTime: number;
  algorithm: RateLimitAlgorithm;
}

interface RateLimitMetrics {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  averageRequestRate: number;
  peakRequestRate: number;
  topViolators: Array<{ key: string; violations: number }>;
}

@Injectable()
export class TokenBucketService {
  private readonly logger = new Logger(TokenBucketService.name);
  private readonly redis: Redis;
  private readonly metrics: Map<string, RateLimitMetrics> = new Map();
  private readonly requestHistory = new Map<string, number[]>();

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });

    this.startMetricsCleanup();
  }

  /**
   * Start metrics cleanup scheduler
   */
  private startMetricsCleanup(): void {
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000); // Every hour
  }

  /**
   * Cleanup old metrics
   */
  private cleanupOldMetrics(): void {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    for (const [key, history] of this.requestHistory.entries()) {
      const filteredHistory = history.filter(timestamp => timestamp > oneHourAgo);
      if (filteredHistory.length === 0) {
        this.requestHistory.delete(key);
      } else {
        this.requestHistory.set(key, filteredHistory);
      }
    }
  }

  /**
   * Check if request is allowed based on token bucket
   * @param key - Unique identifier (user ID, IP, etc.)
   * @param config - Token bucket configuration
   */
  async checkTokenBucketRateLimit(
    key: string,
    config: TokenBucketConfig,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = Math.floor(now / (config.windowSize * 1000));
    const bucketKey = `rate_limit:${key}:${windowStart}`;

    // Get current bucket state
    const bucketState = await this.redis.get(bucketKey);
    let tokens = config.capacity;
    let lastRefill = now;

    if (bucketState) {
      const state = JSON.parse(bucketState);
      tokens = state.tokens;
      lastRefill = state.lastRefill;

      // Refill tokens based on time elapsed
      const timeElapsed = (now - lastRefill) / 1000; // seconds
      const tokensToAdd = timeElapsed * config.refillRate;
      tokens = Math.min(config.capacity, tokens + tokensToAdd);
    }

    // Check if tokens available
    if (tokens >= 1) {
      tokens -= 1;
      const newState = {
        tokens,
        lastRefill: now,
      };

      // Update bucket state with TTL
      await this.redis.setex(
        bucketKey,
        config.windowSize,
        JSON.stringify(newState),
      );

      return {
        allowed: true,
        remainingTokens: tokens,
        resetTime: (windowStart + 1) * config.windowSize * 1000,
        algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
      };
    }

    // Rate limit exceeded
    return {
      allowed: false,
      remainingTokens: 0,
      resetTime: (windowStart + 1) * config.windowSize * 1000,
      algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
    };
  }

  /**
   * Check rate limit using sliding window algorithm
   * @param key - Unique identifier (user ID, IP, etc.)
   * @param config - Sliding window configuration
   */
  async checkSlidingWindowRateLimit(
    key: string,
    config: SlidingWindowConfig,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - (config.windowSize * 1000);
    const windowKey = `sliding_window:${key}`;

    // Get current request history
    const history = await this.redis.lrange(windowKey, 0, -1);
    const timestamps = history.map(t => parseInt(t));

    // Remove timestamps outside the window
    const validTimestamps = timestamps.filter(t => t > windowStart);

    // Check if under limit
    if (validTimestamps.length < config.maxRequests) {
      // Add current request timestamp
      await this.redis.lpush(windowKey, now.toString());
      await this.redis.expire(windowKey, config.windowSize);

      return {
        allowed: true,
        remainingTokens: config.maxRequests - validTimestamps.length - 1,
        resetTime: now + (config.windowSize * 1000),
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
      };
    }

    // Rate limit exceeded
    const oldestTimestamp = validTimestamps[0];
    return {
      allowed: false,
      remainingTokens: 0,
      resetTime: oldestTimestamp + (config.windowSize * 1000),
      algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
    };
  }

  /**
   * Check rate limit using fixed window algorithm
   * @param key - Unique identifier (user ID, IP, etc.)
   * @param config - Fixed window configuration
   */
  async checkFixedWindowRateLimit(
    key: string,
    config: FixedWindowConfig,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = Math.floor(now / (config.windowSize * 1000));
    const windowKey = `fixed_window:${key}:${windowStart}`;

    // Get current count
    const count = await this.redis.incr(windowKey);
    
    // Set expiry on first request
    if (count === 1) {
      await this.redis.expire(windowKey, config.windowSize);
    }

    if (count <= config.maxRequests) {
      return {
        allowed: true,
        remainingTokens: config.maxRequests - count,
        resetTime: (windowStart + 1) * config.windowSize * 1000,
        algorithm: RateLimitAlgorithm.FIXED_WINDOW,
      };
    }

    // Rate limit exceeded
    return {
      allowed: false,
      remainingTokens: 0,
      resetTime: (windowStart + 1) * config.windowSize * 1000,
      algorithm: RateLimitAlgorithm.FIXED_WINDOW,
    };
  }

  /**
   * Universal rate limit checker with algorithm selection
   */
  async checkRateLimit(
    key: string,
    config: TokenBucketConfig | SlidingWindowConfig | FixedWindowConfig,
    algorithm: RateLimitAlgorithm = RateLimitAlgorithm.TOKEN_BUCKET,
  ): Promise<RateLimitResult> {
    // Record request for analytics
    this.recordRequest(key);

    switch (algorithm) {
      case RateLimitAlgorithm.TOKEN_BUCKET:
        return this.checkTokenBucketRateLimit(key, config as TokenBucketConfig);
      case RateLimitAlgorithm.SLIDING_WINDOW:
        return this.checkSlidingWindowRateLimit(key, config as SlidingWindowConfig);
      case RateLimitAlgorithm.FIXED_WINDOW:
        return this.checkFixedWindowRateLimit(key, config as FixedWindowConfig);
      default:
        return this.checkTokenBucketRateLimit(key, config as TokenBucketConfig);
    }
  }

  /**
   * Record request for analytics
   */
  private recordRequest(key: string): void {
    const now = Date.now();
    const history = this.requestHistory.get(key) || [];
    history.push(now);
    this.requestHistory.set(key, history);

    // Update metrics
    let metrics = this.metrics.get(key);
    if (!metrics) {
      metrics = {
        totalRequests: 0,
        allowedRequests: 0,
        blockedRequests: 0,
        averageRequestRate: 0,
        peakRequestRate: 0,
        topViolators: [],
      };
      this.metrics.set(key, metrics);
    }

    metrics.totalRequests++;
  }

  /**
   * Record rate limit decision for analytics
   */
  recordRateLimitDecision(key: string, allowed: boolean): void {
    const metrics = this.metrics.get(key);
    if (metrics) {
      if (allowed) {
        metrics.allowedRequests++;
      } else {
        metrics.blockedRequests++;
      }

      // Update request rate
      const history = this.requestHistory.get(key) || [];
      const oneMinuteAgo = Date.now() - 60000;
      const recentRequests = history.filter(t => t > oneMinuteAgo);
      metrics.averageRequestRate = recentRequests.length;

      if (recentRequests.length > metrics.peakRequestRate) {
        metrics.peakRequestRate = recentRequests.length;
      }
    }
  }

  /**
   * Get rate limit metrics for a key
   */
  getRateLimitMetrics(key: string): RateLimitMetrics | null {
    return this.metrics.get(key) || null;
  }

  /**
   * Get global rate limit analytics
   */
  getGlobalAnalytics(): {
    totalKeys: number;
    totalRequests: number;
    totalAllowed: number;
    totalBlocked: number;
    topViolators: Array<{ key: string; violations: number }>;
  } {
    let totalRequests = 0;
    let totalAllowed = 0;
    let totalBlocked = 0;
    const violators: Array<{ key: string; violations: number }> = [];

    for (const [key, metrics] of this.metrics.entries()) {
      totalRequests += metrics.totalRequests;
      totalAllowed += metrics.allowedRequests;
      totalBlocked += metrics.blockedRequests;

      if (metrics.blockedRequests > 0) {
        violators.push({ key, violations: metrics.blockedRequests });
      }
    }

    violators.sort((a, b) => b.violations - a.violations);

    return {
      totalKeys: this.metrics.size,
      totalRequests,
      totalAllowed,
      totalBlocked,
      topViolators: violators.slice(0, 10),
    };
  }

  /**
   * Reset rate limit for a key (for testing or admin purposes)
   */
  async resetRateLimit(key: string): Promise<void> {
    const pattern = `rate_limit:${key}:*`;
    const slidingPattern = `sliding_window:${key}`;
    const fixedPattern = `fixed_window:${key}:*`;

    const keys = await this.redis.keys(pattern);
    const slidingKeys = await this.redis.keys(slidingPattern);
    const fixedKeys = await this.redis.keys(fixedPattern);

    const allKeys = [...keys, ...slidingKeys, ...fixedKeys];
    if (allKeys.length > 0) {
      await this.redis.del(...allKeys);
    }

    // Reset metrics
    this.metrics.delete(key);
    this.requestHistory.delete(key);
  }

  /**
   * Get current rate limit status
   */
  async getRateLimitStatus(key: string, config: TokenBucketConfig) {
    const now = Date.now();
    const windowStart = Math.floor(now / (config.windowSize * 1000));
    const bucketKey = `rate_limit:${key}:${windowStart}`;

    const bucketState = await this.redis.get(bucketKey);
    if (!bucketState) {
      return {
        tokens: config.capacity,
        resetTime: (windowStart + 1) * config.windowSize * 1000,
      };
    }

    const state = JSON.parse(bucketState);
    const timeElapsed = (now - state.lastRefill) / 1000;
    const tokens = Math.min(
      config.capacity,
      state.tokens + timeElapsed * config.refillRate,
    );

    return {
      tokens,
      resetTime: (windowStart + 1) * config.windowSize * 1000,
    };
  }

  /**
   * Predefined rate limit configurations
   */
  static readonly CONFIGS = {
    // Appointment booking: 10 requests per minute
    APPOINTMENT_BOOKING: {
      capacity: 10,
      refillRate: 10 / 60, // 10 tokens per 60 seconds
      windowSize: 60,
    },

    // Medical records access: 100 requests per minute
    MEDICAL_RECORDS_ACCESS: {
      capacity: 100,
      refillRate: 100 / 60,
      windowSize: 60,
    },

    // Video call initiation: 5 requests per minute
    VIDEO_CALL_INITIATION: {
      capacity: 5,
      refillRate: 5 / 60,
      windowSize: 60,
    },

    // General API: 1000 requests per hour
    GENERAL_API: {
      capacity: 1000,
      refillRate: 1000 / 3600,
      windowSize: 3600,
    },
  };
}
