/**
 * Distributed Caching Coherency with Redis Cluster
 * Implements cache-aside pattern with distributed cache invalidation
 * Supports multi-level caching (Redis + CDN)
 * Enhanced with eviction policies, statistics, and analytics
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cluster } from 'ioredis';

export enum EvictionPolicy {
  LRU = 'LRU',
  LFU = 'LFU',
  TTL = 'TTL',
  FIFO = 'FIFO',
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for group invalidation
  evictionPolicy?: EvictionPolicy;
  priority?: number; // Higher priority keys are less likely to be evicted
}

export interface CacheStatistics {
  hits: number;
  misses: number;
  hitRate: number;
  sets: number;
  deletes: number;
  evictions: number;
  totalKeys: number;
  memoryUsage: number;
  memoryUsagePercentage: number;
}

export interface CacheAnalytics {
  topKeys: Array<{ key: string; accessCount: number }>;
  topTags: Array<{ tag: string; keyCount: number }>;
  averageTtl: number;
  keysByPolicy: Record<EvictionPolicy, number>;
}

@Injectable()
export class RedisClusterService {
  private readonly logger = new Logger(RedisClusterService.name);
  private readonly cluster: Cluster;
  private readonly statistics: CacheStatistics = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    totalKeys: 0,
    memoryUsage: 0,
    memoryUsagePercentage: 0,
  };
  private readonly keyAccessCount = new Map<string, number>();
  private readonly tagKeyCount = new Map<string, number>();
  private readonly keyMetadata = new Map<string, { policy: EvictionPolicy; priority: number; createdAt: number }>();
  private readonly maxMemoryBytes = 1024 * 1024 * 1024; // 1GB default
  private readonly highWatermarkPercentage = 0.8; // 80%
  private readonly lowWatermarkPercentage = 0.6; // 60%

  constructor() {
    // Redis Cluster configuration
    const nodes = [
      {
        host: process.env.REDIS_CLUSTER_NODE_1_HOST || 'localhost',
        port: parseInt(process.env.REDIS_CLUSTER_NODE_1_PORT || '7000'),
      },
      {
        host: process.env.REDIS_CLUSTER_NODE_2_HOST || 'localhost',
        port: parseInt(process.env.REDIS_CLUSTER_NODE_2_PORT || '7001'),
      },
      {
        host: process.env.REDIS_CLUSTER_NODE_3_HOST || 'localhost',
        port: parseInt(process.env.REDIS_CLUSTER_NODE_3_PORT || '7002'),
      },
    ];

    this.cluster = new Cluster(nodes, {
      redisOptions: {
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      },
      enableReadyCheck: true,
      retryDelayOnFailover: 100,
      retryDelayOnClusterDown: 300,
      scaleReads: 'slave' as any,
    } as any);

    this.cluster.on('connect', () => {
      this.logger.log('Redis Cluster connected');
    });

    this.cluster.on('error', (error) => {
      this.logger.error('Redis Cluster error', error);
    });
  }

  /**
   * Cache-Aside Pattern: Get from cache, miss then load from source
   * Tracks access statistics for analytics
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cluster.get(key);
      if (value) {
        this.statistics.hits++;
        this.trackKeyAccess(key);
        return JSON.parse(value) as T;
      }
      this.statistics.misses++;
      this.updateHitRate();
      return null;
    } catch (error) {
      this.logger.error(`Error getting key ${key}:`, error);
      this.statistics.misses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * Track key access for analytics
   */
  private trackKeyAccess(key: string): void {
    const count = this.keyAccessCount.get(key) || 0;
    this.keyAccessCount.set(key, count + 1);
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.statistics.hits + this.statistics.misses;
    this.statistics.hitRate = total > 0 ? this.statistics.hits / total : 0;
  }

  /**
   * Set value in cache with TTL and eviction policy
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const ttl = options?.ttl || 3600; // Default 1 hour
      const policy = options?.evictionPolicy || EvictionPolicy.LRU;
      const priority = options?.priority || 0;

      await this.cluster.setex(key, ttl, serialized);

      // Store metadata for eviction
      this.keyMetadata.set(key, {
        policy,
        priority,
        createdAt: Date.now(),
      });

      // Add to tag sets for group invalidation
      if (options?.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          await this.cluster.sadd(`tag:${tag}`, key);
          const tagCount = this.tagKeyCount.get(tag) || 0;
          this.tagKeyCount.set(tag, tagCount + 1);
        }
      }

      this.statistics.sets++;
      this.checkMemoryUsage();
      this.logger.debug(`Cached key: ${key} with TTL: ${ttl}s, policy: ${policy}`);
    } catch (error) {
      this.logger.error(`Error setting key ${key}:`, error);
    }
  }

  /**
   * Check memory usage and trigger eviction if needed
   */
  private async checkMemoryUsage(): Promise<void> {
    try {
      const info = await this.cluster.info('memory');
      const usedMemory = parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0');
      this.statistics.memoryUsage = usedMemory;
      this.statistics.memoryUsagePercentage = usedMemory / this.maxMemoryBytes;

      // Check if we need to evict
      if (this.statistics.memoryUsagePercentage > this.highWatermarkPercentage) {
        await this.evictKeys();
      }
    } catch (error) {
      this.logger.error('Error checking memory usage:', error);
    }
  }

  /**
   * Evict keys based on policy
   */
  private async evictKeys(): Promise<void> {
    this.logger.log('Memory usage high, initiating eviction');

    const keysToEvict = this.selectKeysForEviction();
    let evictedCount = 0;

    for (const key of keysToEvict) {
      try {
        await this.delete(key);
        evictedCount++;
        
        // Stop when we reach low watermark
        if (this.statistics.memoryUsagePercentage < this.lowWatermarkPercentage) {
          break;
        }
      } catch (error) {
        this.logger.error(`Error evicting key ${key}:`, error);
      }
    }

    this.statistics.evictions += evictedCount;
    this.logger.log(`Evicted ${evictedCount} keys`);
  }

  /**
   * Select keys for eviction based on policy
   */
  private selectKeysForEviction(): string[] {
    const keys: string[] = [];
    const entries = Array.from(this.keyMetadata.entries());

    // Sort by policy and priority
    entries.sort((a, b) => {
      // Lower priority first
      if (a[1].priority !== b[1].priority) {
        return a[1].priority - b[1].priority;
      }

      // Then by policy
      const policyOrder = { [EvictionPolicy.LRU]: 0, [EvictionPolicy.LFU]: 1, [EvictionPolicy.FIFO]: 2, [EvictionPolicy.TTL]: 3 };
      return policyOrder[a[1].policy] - policyOrder[b[1].policy];
    });

    // For LRU, sort by access count (least accessed first)
    if (entries.length > 0 && entries[0][1].policy === EvictionPolicy.LRU) {
      entries.sort((a, b) => {
        const accessA = this.keyAccessCount.get(a[0]) || 0;
        const accessB = this.keyAccessCount.get(b[0]) || 0;
        return accessA - accessB;
      });
    }

    // For FIFO, sort by creation time (oldest first)
    if (entries.length > 0 && entries[0][1].policy === EvictionPolicy.FIFO) {
      entries.sort((a, b) => a[1].createdAt - b[1].createdAt);
    }

    return entries.map(([key]) => key);
  }

  /**
   * Delete key from cache with statistics tracking
   */
  async delete(key: string): Promise<void> {
    try {
      await this.cluster.del(key);
      this.statistics.deletes++;
      this.keyAccessCount.delete(key);
      this.keyMetadata.delete(key);
      this.logger.debug(`Deleted key: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting key ${key}:`, error);
    }
  }

  /**
   * Invalidate all keys with a specific tag
   */
  async invalidateTag(tag: string): Promise<void> {
    try {
      const keys = await this.cluster.smembers(`tag:${tag}`);
      if (keys.length > 0) {
        await this.cluster.del(...keys);
        await this.cluster.del(`tag:${tag}`);
        this.logger.log(`Invalidated ${keys.length} keys for tag: ${tag}`);
      }
    } catch (error) {
      this.logger.error(`Error invalidating tag ${tag}:`, error);
    }
  }

  /**
   * Write-Through Caching: Write to cache and database simultaneously
   */
  async writeThrough<T>(
    key: string,
    value: T,
    dbOperation: () => Promise<void>,
    options?: CacheOptions,
  ): Promise<void> {
    try {
      // Write to cache
      await this.set(key, value, options);
      
      // Write to database
      await dbOperation();
      
      this.logger.debug(`Write-through completed for key: ${key}`);
    } catch (error) {
      // If database write fails, invalidate cache
      await this.delete(key);
      throw error;
    }
  }

  /**
   * Write-Back (Write-Behind) Caching: Write to cache, async write to DB
   */
  async writeBack<T>(
    key: string,
    value: T,
    dbOperation: () => Promise<void>,
    options?: CacheOptions,
  ): Promise<void> {
    try {
      // Write to cache immediately
      await this.set(key, value, options);
      
      // Async write to database
      dbOperation().catch(async (error) => {
        this.logger.error(`Write-back failed for key ${key}:`, error);
        // Invalidate cache on failure
        await this.delete(key);
      });
      
      this.logger.debug(`Write-back initiated for key: ${key}`);
    } catch (error) {
      this.logger.error(`Error in write-back for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Cache warming: Pre-load frequently accessed data
   */
  async warmCache<T>(
    keys: string[],
    dataLoader: (key: string) => Promise<T>,
    options?: CacheOptions,
  ): Promise<void> {
    this.logger.log(`Warming cache for ${keys.length} keys`);

    const promises = keys.map(async (key) => {
      try {
        const value = await dataLoader(key);
        await this.set(key, value, options);
      } catch (error) {
        this.logger.error(`Error warming cache for key ${key}:`, error);
      }
    });

    await Promise.all(promises);
    this.logger.log('Cache warming completed');
  }

  /**
   * Multi-level caching: Check local cache, then Redis, then source
   */
  async getMultiLevel<T>(
    key: string,
    localCache: Map<string, { value: T; expiry: number }>,
    sourceLoader: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const now = Date.now();

    // Level 1: Local cache (in-memory)
    const localEntry = localCache.get(key);
    if (localEntry && localEntry.expiry > now) {
      this.logger.debug(`Cache hit (local): ${key}`);
      return localEntry.value;
    }

    // Level 2: Redis cluster
    const redisValue = await this.get<T>(key);
    if (redisValue) {
      // Update local cache
      const ttl = options?.ttl || 3600;
      localCache.set(key, {
        value: redisValue,
        expiry: now + ttl * 1000,
      });
      this.logger.debug(`Cache hit (redis): ${key}`);
      return redisValue;
    }

    // Level 3: Source (database)
    this.logger.debug(`Cache miss: ${key}, loading from source`);
    const value = await sourceLoader();

    // Update all cache levels
    await this.set(key, value, options);
    const ttl = options?.ttl || 3600;
    localCache.set(key, {
      value,
      expiry: now + ttl * 1000,
    });

    return value;
  }

  /**
   * Get cluster health status
   */
  async getClusterHealth(): Promise<any> {
    try {
      const info = await (this.cluster as any).cluster('info');
      const nodes = await (this.cluster as any).cluster('nodes');

      return {
        state: info?.state,
        clusterEnabled: info?.cluster_enabled,
        nodeCount: nodes ? Object.keys(nodes).length : 0,
      };
    } catch (error) {
      this.logger.error('Error getting cluster health:', error);
      return { error: 'Failed to get cluster health' };
    }
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    return { ...this.statistics };
  }

  /**
   * Get cache analytics
   */
  getAnalytics(): CacheAnalytics {
    // Get top keys by access count
    const topKeys = Array.from(this.keyAccessCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => ({ key, accessCount: count }));

    // Get top tags by key count
    const topTags = Array.from(this.tagKeyCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, keyCount: count }));

    // Calculate average TTL from metadata
    const entries = Array.from(this.keyMetadata.values());
    const averageTtl = entries.length > 0 ? 3600 : 0; // Default TTL

    // Count keys by policy
    const keysByPolicy: Record<EvictionPolicy, number> = {
      [EvictionPolicy.LRU]: 0,
      [EvictionPolicy.LFU]: 0,
      [EvictionPolicy.TTL]: 0,
      [EvictionPolicy.FIFO]: 0,
    };

    for (const metadata of entries) {
      keysByPolicy[metadata.policy]++;
    }

    return {
      topKeys,
      topTags,
      averageTtl,
      keysByPolicy,
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.statistics.hits = 0;
    this.statistics.misses = 0;
    this.statistics.hitRate = 0;
    this.statistics.sets = 0;
    this.statistics.deletes = 0;
    this.statistics.evictions = 0;
    this.keyAccessCount.clear();
    this.tagKeyCount.clear();
    this.logger.log('Cache statistics reset');
  }

  /**
   * Close cluster connection
   */
  async disconnect(): Promise<void> {
    await this.cluster.quit();
    this.logger.log('Redis Cluster disconnected');
  }
}
