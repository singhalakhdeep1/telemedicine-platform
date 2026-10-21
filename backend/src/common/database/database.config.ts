/**
 * Database Connection Pooling Configuration with Dynamic Resizing
 * Implements connection pooling optimization for high-concurrency scenarios
 * Supports read replicas, sharding, and dynamic pool resizing
 * Enhanced with health checks and auto-scaling
 */

import { PrismaClient } from '@prisma/client';

export interface PoolHealth {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  healthScore: number;
}

export interface PoolMetrics {
  averageWaitTime: number;
  peakConnections: number;
  totalQueries: number;
  failedQueries: number;
  resizeEvents: number;
}

export class DatabaseConfig {
  private static currentPoolSize = 200;
  private static minPoolSize = 10;
  private static maxPoolSize = 500;
  private static healthCheckInterval = 30000; // 30 seconds
  private static resizeThreshold = 0.8; // 80% utilization triggers resize
  private static metrics: PoolMetrics = {
    averageWaitTime: 0,
    peakConnections: 0,
    totalQueries: 0,
    failedQueries: 0,
    resizeEvents: 0,
  };

  /**
   * Connection Pool Configuration with dynamic resizing
   * Optimized for video consultation sessions and high concurrency
   */
  static getConnectionPoolConfig() {
    return {
      // Connection pool size (dynamic)
      connectionLimit: this.currentPoolSize,

      // Minimum connections to keep alive
      minConnections: this.minPoolSize,

      // Maximum connections allowed
      maxConnections: this.maxPoolSize,

      // Maximum time a connection can be idle before being closed
      idleTimeout: 30000, // 30 seconds

      // Maximum time a connection can be reused
      lifetimeTimeout: 3600000, // 1 hour

      // Connection timeout
      connectionTimeout: 10000, // 10 seconds

      // Enable prepared statements for better performance
      prepare: true,

      // Enable query logging in development
      log: (process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error']) as any,

      // Enable dynamic resizing
      enableDynamicResizing: true,

      // Resize check interval
      resizeCheckInterval: 60000, // 1 minute
    };
  }

  /**
   * Get current pool health status
   */
  static getPoolHealth(): PoolHealth {
    const utilization = this.metrics.totalQueries > 0 
      ? this.metrics.peakConnections / this.currentPoolSize 
      : 0;
    
    const healthScore = Math.max(0, 100 - (utilization * 100));

    return {
      totalConnections: this.currentPoolSize,
      activeConnections: Math.floor(this.currentPoolSize * utilization),
      idleConnections: this.currentPoolSize - Math.floor(this.currentPoolSize * utilization),
      waitingRequests: Math.floor(this.metrics.averageWaitTime / 100),
      healthScore,
    };
  }

  /**
   * Check if pool needs resizing
   */
  static needsResize(): { needsResize: boolean; newSize?: number; direction?: 'up' | 'down' } {
    const health = this.getPoolHealth();
    const utilization = health.activeConnections / health.totalConnections;

    // Scale up if utilization is high
    if (utilization > this.resizeThreshold && this.currentPoolSize < this.maxPoolSize) {
      const newSize = Math.min(
        this.maxPoolSize,
        Math.floor(this.currentPoolSize * 1.5),
      );
      return { needsResize: true, newSize, direction: 'up' };
    }

    // Scale down if utilization is low
    if (utilization < 0.3 && this.currentPoolSize > this.minPoolSize) {
      const newSize = Math.max(
        this.minPoolSize,
        Math.floor(this.currentPoolSize * 0.7),
      );
      return { needsResize: true, newSize, direction: 'down' };
    }

    return { needsResize: false };
  }

  /**
   * Resize connection pool
   */
  static resizePool(newSize: number): void {
    if (newSize < this.minPoolSize || newSize > this.maxPoolSize) {
      throw new Error(`Pool size must be between ${this.minPoolSize} and ${this.maxPoolSize}`);
    }

    const oldSize = this.currentPoolSize;
    this.currentPoolSize = newSize;
    this.metrics.resizeEvents++;

    console.log(`Connection pool resized from ${oldSize} to ${newSize}`);
  }

  /**
   * Auto-resize pool based on health metrics
   */
  static autoResizePool(): void {
    const { needsResize, newSize, direction } = this.needsResize();

    if (needsResize && newSize) {
      this.resizePool(newSize);
      console.log(`Auto-resized pool ${direction} to ${newSize}`);
    }
  }

  /**
   * Get pool metrics
   */
  static getPoolMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset pool metrics
   */
  static resetPoolMetrics(): void {
    this.metrics = {
      averageWaitTime: 0,
      peakConnections: 0,
      totalQueries: 0,
      failedQueries: 0,
      resizeEvents: 0,
    };
  }

  /**
   * Update query metrics
   */
  static recordQuery(waitTime: number, success: boolean): void {
    this.metrics.totalQueries++;
    if (!success) {
      this.metrics.failedQueries++;
    }

    // Update average wait time
    this.metrics.averageWaitTime = 
      (this.metrics.averageWaitTime * (this.metrics.totalQueries - 1) + waitTime) / 
      this.metrics.totalQueries;

    // Update peak connections
    const health = this.getPoolHealth();
    if (health.activeConnections > this.metrics.peakConnections) {
      this.metrics.peakConnections = health.activeConnections;
    }
  }

  /**
   * Perform comprehensive health check
   */
  static performHealthCheck(): { healthy: boolean; issues: string[]; recommendations: string[] } {
    const health = this.getPoolHealth();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check health score
    if (health.healthScore < 50) {
      issues.push(`Low health score: ${health.healthScore.toFixed(2)}`);
      recommendations.push('Consider increasing pool size or optimizing queries');
    }

    // Check wait time
    if (this.metrics.averageWaitTime > 1000) {
      issues.push(`High average wait time: ${this.metrics.averageWaitTime.toFixed(2)}ms`);
      recommendations.push('Consider increasing pool size or adding read replicas');
    }

    // Check failure rate
    const failureRate = this.metrics.totalQueries > 0 
      ? this.metrics.failedQueries / this.metrics.totalQueries 
      : 0;
    if (failureRate > 0.05) {
      issues.push(`High failure rate: ${(failureRate * 100).toFixed(2)}%`);
      recommendations.push('Check database connectivity and query performance');
    }

    // Check utilization
    const utilization = health.activeConnections / health.totalConnections;
    if (utilization > 0.9) {
      issues.push(`High connection utilization: ${(utilization * 100).toFixed(2)}%`);
      recommendations.push('Increase pool size immediately');
    }

    return {
      healthy: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * Start health check scheduler
   */
  static startHealthCheckScheduler(): void {
    setInterval(() => {
      const healthCheck = this.performHealthCheck();
      
      if (!healthCheck.healthy) {
        console.warn('Pool health check failed:', healthCheck.issues);
        console.info('Recommendations:', healthCheck.recommendations);
        
        // Auto-resize if needed
        this.autoResizePool();
      }
    }, this.healthCheckInterval);
  }

  /**
   * Get detailed pool statistics
   */
  static getDetailedStatistics(): {
    health: PoolHealth;
    metrics: PoolMetrics;
    config: {
      currentPoolSize: number;
      minPoolSize: number;
      maxPoolSize: number;
      resizeThreshold: number;
    };
  } {
    return {
      health: this.getPoolHealth(),
      metrics: this.getPoolMetrics(),
      config: {
        currentPoolSize: this.currentPoolSize,
        minPoolSize: this.minPoolSize,
        maxPoolSize: this.maxPoolSize,
        resizeThreshold: this.resizeThreshold,
      },
    };
  }

  /**
   * Prisma Client with optimized connection pooling
   */
  static createPrismaClient(): PrismaClient {
    const config = this.getConnectionPoolConfig();

    return new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: config.log,
    });
  }

  /**
   * Read Replica Configuration
   * For medical records analytics and reporting queries
   */
  static getReadReplicaConfig() {
    return {
      // Primary database for writes
      primary: process.env.DATABASE_URL,

      // Read replicas for analytics queries
      replicas: [
        process.env.DATABASE_READ_REPLICA_1_URL,
        process.env.DATABASE_READ_REPLICA_2_URL,
      ].filter(Boolean),

      // Load balancing strategy
      loadBalancing: 'round-robin', // or 'least-connections'

      // Read replica lag tolerance (in milliseconds)
      replicaLagTolerance: 1000,
    };
  }

  /**
   * Database Sharding Configuration
   * Shard by hospital/region for scalability
   */
  static getShardingConfig() {
    return {
      // Sharding strategy: hash-based on hospital_id
      strategy: 'hash',

      // Shard key field
      shardKey: 'hospital_id',

      // Number of shards
      shardCount: 4,

      // Shard connection URLs
      shards: [
        process.env.DATABASE_SHARD_0_URL,
        process.env.DATABASE_SHARD_1_URL,
        process.env.DATABASE_SHARD_2_URL,
        process.env.DATABASE_SHARD_3_URL,
      ].filter(Boolean),

      // Shard mapping for regions
      regionMapping: {
        'us-east': [0, 1],
        'us-west': [2],
        'eu-west': [3],
      },
    };
  }

  /**
   * Get shard for a given hospital ID
   */
  static getShardForHospital(hospitalId: string): number {
    const shardCount = this.getShardingConfig().shardCount;
    const hash = this.hashCode(hospitalId);
    return Math.abs(hash) % shardCount;
  }

  /**
   * Simple hash function for sharding
   */
  private static hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }
}
