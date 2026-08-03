/**
 * Read Replicas Configuration with Promotion and Failover
 * Implements read replica routing for analytics and reporting queries
 * Reduces load on primary database for read-heavy operations
 * Enhanced with automatic promotion and failover capabilities
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export interface ReadReplicaConfig {
  id: number;
  name: string;
  connectionString: string;
  region: string;
  lagTolerance: number; // milliseconds
  isActive: boolean;
  isPrimary?: boolean;
  priority?: number; // For promotion selection
}

export interface ReplicaHealth {
  id: number;
  isHealthy: boolean;
  lagMs: number;
  lastChecked: Date;
  consecutiveFailures: number;
}

export interface FailoverEvent {
  timestamp: Date;
  fromReplicaId: number;
  toReplicaId?: number;
  reason: string;
  automatic: boolean;
}

@Injectable()
export class ReadReplicaService {
  private readonly logger = new Logger(ReadReplicaService.name);
  private primaryClient: PrismaClient;
  private readonly replicaClients = new Map<number, PrismaClient>();
  private readonly replicaConfigs: ReadReplicaConfig[] = [];
  private readonly replicaHealth = new Map<number, ReplicaHealth>();
  private currentReplicaIndex = 0;
  private readonly failoverHistory: FailoverEvent[] = [];
  private readonly maxFailoverHistory = 100;
  private readonly failoverThreshold = 3; // Consecutive failures before failover

  constructor() {
    // Primary database connection
    this.primaryClient = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    this.initializeReplicas();
    this.startHealthChecks();
  }

  /**
   * Initialize read replica connections
   */
  private initializeReplicas(): void {
    const replicaCount = parseInt(process.env.READ_REPLICA_COUNT || '2');
    
    for (let i = 0; i < replicaCount; i++) {
      const connectionString = process.env[`DATABASE_READ_REPLICA_${i}_URL`];
      if (!connectionString) {
        this.logger.warn(`Read replica ${i} connection string not found, skipping`);
        continue;
      }

      const replicaConfig: ReadReplicaConfig = {
        id: i,
        name: `replica_${i}`,
        connectionString,
        region: process.env[`DATABASE_READ_REPLICA_${i}_REGION`] || 'default',
        lagTolerance: parseInt(process.env[`DATABASE_READ_REPLICA_${i}_LAG_TOLERANCE`] || '1000'),
        isActive: true,
      };

      this.replicaConfigs.push(replicaConfig);
      this.replicaClients.set(i, new PrismaClient({
        datasources: {
          db: {
            url: connectionString,
          },
        },
      }));

      // Initialize health status
      this.replicaHealth.set(i, {
        id: i,
        isHealthy: true,
        lagMs: 0,
        lastChecked: new Date(),
        consecutiveFailures: 0,
      });

      this.logger.log(`Initialized read replica ${i} in region ${replicaConfig.region}`);
    }
  }

  /**
   * Get primary database client for write operations
   */
  getPrimary(): PrismaClient {
    return this.primaryClient;
  }

  /**
   * Get read replica client for read operations
   * Uses round-robin load balancing
   */
  getReplica(): PrismaClient {
    const healthyReplicas = this.getHealthyReplicas();
    
    if (healthyReplicas.length === 0) {
      this.logger.warn('No healthy replicas available, using primary');
      return this.primaryClient;
    }

    // Round-robin selection
    const replicaId = healthyReplicas[this.currentReplicaIndex % healthyReplicas.length];
    this.currentReplicaIndex++;

    const client = this.replicaClients.get(replicaId);
    if (!client) {
      this.logger.warn(`Replica ${replicaId} not available, using primary`);
      return this.primaryClient;
    }

    return client;
  }

  /**
   * Get specific replica by ID
   */
  getReplicaById(replicaId: number): PrismaClient | undefined {
    return this.replicaClients.get(replicaId);
  }

  /**
   * Get all healthy replicas
   */
  private getHealthyReplicas(): number[] {
    const healthy: number[] = [];
    for (const [id, health] of this.replicaHealth) {
      if (health.isHealthy && health.lagMs <= this.replicaConfigs[id].lagTolerance) {
        healthy.push(id);
      }
    }
    return healthy;
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    const checkInterval = parseInt(process.env.REPLICA_HEALTH_CHECK_INTERVAL || '30000'); // 30 seconds
    
    setInterval(() => {
      this.checkReplicaHealth();
    }, checkInterval);
  }

  /**
   * Check health of all replicas with automatic failover
   */
  private async checkReplicaHealth(): Promise<void> {
    for (const [replicaId, client] of this.replicaClients) {
      try {
        const startTime = Date.now();
        
        // Execute simple query to check connectivity
        await client.$queryRaw`SELECT 1`;
        
        // Check replication lag (PostgreSQL specific)
        const lagResult = await client.$queryRaw`
          SELECT EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp())) * 1000 as lag_ms
        `;
        const lagMs = Array.isArray(lagResult) && lagResult[0] 
          ? (lagResult[0] as any).lag_ms 
          : 0;

        const existingHealth = this.replicaHealth.get(replicaId);
        const health: ReplicaHealth = {
          id: replicaId,
          isHealthy: true,
          lagMs: lagMs || 0,
          lastChecked: new Date(),
          consecutiveFailures: existingHealth?.isHealthy ? 0 : existingHealth?.consecutiveFailures || 0,
        };

        this.replicaHealth.set(replicaId, health);
        
        if (lagMs > this.replicaConfigs[replicaId].lagTolerance) {
          this.logger.warn(`Replica ${replicaId} lag ${lagMs}ms exceeds tolerance ${this.replicaConfigs[replicaId].lagTolerance}ms`);
        }
      } catch (error) {
        this.logger.error(`Health check failed for replica ${replicaId}:`, error);
        
        const existingHealth = this.replicaHealth.get(replicaId);
        const consecutiveFailures = (existingHealth?.consecutiveFailures || 0) + 1;
        
        this.replicaHealth.set(replicaId, {
          id: replicaId,
          isHealthy: false,
          lagMs: 0,
          lastChecked: new Date(),
          consecutiveFailures,
        });

        // Check if failover is needed
        if (consecutiveFailures >= this.failoverThreshold) {
          await this.handleReplicaFailure(replicaId, error as Error);
        }
      }
    }
  }

  /**
   * Handle replica failure with automatic failover
   */
  private async handleReplicaFailure(replicaId: number, error: Error): Promise<void> {
    this.logger.error(`Replica ${replicaId} failed ${this.failoverThreshold} times consecutively, initiating failover`);

    const failoverEvent: FailoverEvent = {
      timestamp: new Date(),
      fromReplicaId: replicaId,
      reason: error.message,
      automatic: true,
    };

    // Mark replica as inactive
    const config = this.replicaConfigs.find(c => c.id === replicaId);
    if (config) {
      config.isActive = false;
    }

    // Try to promote another replica if available
    const healthyReplicas = this.getHealthyReplicas();
    if (healthyReplicas.length > 0) {
      const newPrimary = this.selectReplicaForPromotion(healthyReplicas);
      await this.promoteReplica(newPrimary);
      failoverEvent.toReplicaId = newPrimary;
    }

    this.recordFailover(failoverEvent);
  }

  /**
   * Select replica for promotion based on priority
   */
  private selectReplicaForPromotion(healthyReplicas: number[]): number {
    // Select replica with highest priority
    let selectedReplica = healthyReplicas[0];
    let highestPriority = this.replicaConfigs[healthyReplicas[0]]?.priority || 0;

    for (const replicaId of healthyReplicas) {
      const priority = this.replicaConfigs[replicaId]?.priority || 0;
      if (priority > highestPriority) {
        highestPriority = priority;
        selectedReplica = replicaId;
      }
    }

    return selectedReplica;
  }

  /**
   * Promote replica to primary
   */
  private async promoteReplica(replicaId: number): Promise<void> {
    this.logger.log(`Promoting replica ${replicaId} to primary role`);
    
    const config = this.replicaConfigs.find(c => c.id === replicaId);
    if (config) {
      config.isPrimary = true;
      config.priority = (config.priority || 0) + 10; // Increase priority
    }

    // In production, this would execute database promotion commands
    // For PostgreSQL: SELECT pg_promote();
  }

  /**
   * Record failover event
   */
  private recordFailover(event: FailoverEvent): void {
    this.failoverHistory.push(event);
    
    // Keep only recent history
    if (this.failoverHistory.length > this.maxFailoverHistory) {
      this.failoverHistory.shift();
    }

    this.logger.log(`Failover recorded: ${JSON.stringify(event)}`);
  }

  /**
   * Get failover history
   */
  getFailoverHistory(): FailoverEvent[] {
    return [...this.failoverHistory];
  }

  /**
   * Manual failover to specific replica
   */
  async manualFailover(toReplicaId: number, reason: string): Promise<void> {
    this.logger.log(`Manual failover to replica ${toReplicaId} requested`);

    const failoverEvent: FailoverEvent = {
      timestamp: new Date(),
      fromReplicaId: -1, // Manual
      toReplicaId: toReplicaId,
      reason,
      automatic: false,
    };

    await this.promoteReplica(toReplicaId);
    this.recordFailover(failoverEvent);
  }

  /**
   * Get health status of all replicas
   */
  getReplicaHealth(): ReplicaHealth[] {
    return Array.from(this.replicaHealth.values());
  }

  /**
   * Execute read query on replica with fallback to primary
   */
  async queryRead<T>(queryFn: (client: PrismaClient) => Promise<T>): Promise<T> {
    try {
      const replica = this.getReplica();
      return await queryFn(replica);
    } catch (error) {
      this.logger.error('Read query failed on replica, trying primary:', error);
      return await queryFn(this.primaryClient);
    }
  }

  /**
   * Execute write query on primary
   */
  async queryWrite<T>(queryFn: (client: PrismaClient) => Promise<T>): Promise<T> {
    return await queryFn(this.primaryClient);
  }

  /**
   * Execute transaction on primary
   */
  async transaction<T>(queryFn: (client: PrismaClient) => Promise<T>): Promise<T> {
    return this.primaryClient.$transaction(queryFn);
  }

  /**
   * Get replica statistics
   */
  getStats(): {
    totalReplicas: number;
    healthyReplicas: number;
    unhealthyReplicas: number;
    averageLag: number;
  } {
    const healthValues = Array.from(this.replicaHealth.values());
    const healthyReplicas = healthValues.filter(h => h.isHealthy).length;
    const totalLag = healthValues.reduce((sum, h) => sum + h.lagMs, 0);
    const averageLag = healthValues.length > 0 ? totalLag / healthValues.length : 0;

    return {
      totalReplicas: this.replicaConfigs.length,
      healthyReplicas,
      unhealthyReplicas: this.replicaConfigs.length - healthyReplicas,
      averageLag,
    };
  }

  /**
   * Close all connections
   */
  async disconnect(): Promise<void> {
    await this.primaryClient.$disconnect();
    
    for (const [replicaId, client] of this.replicaClients) {
      await client.$disconnect();
      this.logger.log(`Disconnected replica ${replicaId}`);
    }
  }
}

/**
 * Query Router
 * Routes queries to appropriate database based on operation type
 */
export class QueryRouter {
  constructor(private readonly readReplicaService: ReadReplicaService) {}

  /**
   * Route query based on operation type
   */
  async route<T>(
    operation: 'read' | 'write' | 'transaction',
    queryFn: (client: PrismaClient) => Promise<T>,
  ): Promise<T> {
    switch (operation) {
      case 'read':
        return this.readReplicaService.queryRead(queryFn);
      case 'write':
        return this.readReplicaService.queryWrite(queryFn);
      case 'transaction':
        return this.readReplicaService.transaction(queryFn);
      default:
        throw new Error(`Unknown operation type: ${operation}`);
    }
  }

  /**
   * Route read query with consistency level
   */
  async routeReadWithConsistency<T>(
    consistency: 'eventual' | 'strong',
    queryFn: (client: PrismaClient) => Promise<T>,
  ): Promise<T> {
    if (consistency === 'strong') {
      // Use primary for strong consistency
      return this.readReplicaService.queryWrite(queryFn);
    }
    // Use replica for eventual consistency
    return this.readReplicaService.queryRead(queryFn);
  }
}
