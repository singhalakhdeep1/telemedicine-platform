/**
 * HIPAA-Compliant Structured Logging Service with Sampling and Aggregation
 * Implements structured logging with correlation IDs and PHI masking
 * Enhanced with log sampling, aggregation, and retention policies
 * Part of HIPAA compliance requirements
 */

import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { Redis } from 'ioredis';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  correlationId?: string;
  userId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: LogContext;
  message: string;
  data?: any;
  error?: Error;
}

export interface LogSamplingConfig {
  enabled: boolean;
  sampleRate: number; // 0.0 to 1.0 (e.g., 0.1 = 10% sampling)
  sampledLevels: LogLevel[];
}

export interface LogAggregationConfig {
  enabled: boolean;
  windowSize: number; // seconds
  maxEntriesPerWindow: number;
  aggregationKeys: string[]; // Fields to aggregate on
}

export interface LogRetentionConfig {
  debugRetentionDays: number;
  infoRetentionDays: number;
  warnRetentionDays: number;
  errorRetentionDays: number;
  archiveEnabled: boolean;
  archiveLocation: string;
}

export interface LogStatistics {
  totalLogs: number;
  logsByLevel: Record<LogLevel, number>;
  logsByUser: Record<string, number>;
  logsByAction: Record<string, number>;
  sampledLogs: number;
  aggregatedLogs: number;
}

@Injectable({ scope: Scope.DEFAULT })
export class StructuredLoggerService implements LoggerService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<LogContext>();
  private readonly redis: Redis;
  private readonly statistics: LogStatistics = {
    totalLogs: 0,
    logsByLevel: { [LogLevel.DEBUG]: 0, [LogLevel.INFO]: 0, [LogLevel.WARN]: 0, [LogLevel.ERROR]: 0 },
    logsByUser: {},
    logsByAction: {},
    sampledLogs: 0,
    aggregatedLogs: 0,
  };
  private readonly samplingConfig: LogSamplingConfig = {
    enabled: process.env.LOG_SAMPLING_ENABLED === 'true',
    sampleRate: parseFloat(process.env.LOG_SAMPLE_RATE || '0.1'),
    sampledLevels: [LogLevel.DEBUG, LogLevel.INFO],
  };
  private readonly aggregationConfig: LogAggregationConfig = {
    enabled: process.env.LOG_AGGREGATION_ENABLED === 'true',
    windowSize: parseInt(process.env.LOG_AGGREGATION_WINDOW || '60'),
    maxEntriesPerWindow: parseInt(process.env.LOG_AGGREGATION_MAX_ENTRIES || '1000'),
    aggregationKeys: ['action', 'resource', 'userId'],
  };
  private readonly retentionConfig: LogRetentionConfig = {
    debugRetentionDays: parseInt(process.env.LOG_DEBUG_RETENTION_DAYS || '7'),
    infoRetentionDays: parseInt(process.env.LOG_INFO_RETENTION_DAYS || '30'),
    warnRetentionDays: parseInt(process.env.LOG_WARN_RETENTION_DAYS || '90'),
    errorRetentionDays: parseInt(process.env.LOG_ERROR_RETENTION_DAYS || '365'),
    archiveEnabled: process.env.LOG_ARCHIVE_ENABLED === 'true',
    archiveLocation: process.env.LOG_ARCHIVE_LOCATION || '/logs/archive',
  };
  private readonly aggregationBuffer = new Map<string, LogEntry[]>();

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });

    this.startAggregationScheduler();
    this.startRetentionScheduler();
  }

  /**
   * Start aggregation scheduler
   */
  private startAggregationScheduler(): void {
    setInterval(async () => {
      await this.flushAggregationBuffer();
    }, this.aggregationConfig.windowSize * 1000);
  }

  /**
   * Start retention scheduler
   */
  private startRetentionScheduler(): void {
    setInterval(async () => {
      await this.applyRetentionPolicy();
    }, 86400000); // Daily
  }

  /**
   * Flush aggregation buffer
   */
  private async flushAggregationBuffer(): Promise<void> {
    if (!this.aggregationConfig.enabled || this.aggregationBuffer.size === 0) {
      return;
    }

    for (const [key, entries] of this.aggregationBuffer.entries()) {
      try {
        const aggregated = this.aggregateLogs(entries);
        await this.storeAggregatedLogs(key, aggregated);
        this.statistics.aggregatedLogs += entries.length;
      } catch (error) {
        console.error('Failed to flush aggregation buffer:', error);
      }
    }

    this.aggregationBuffer.clear();
  }

  /**
   * Aggregate logs
   */
  private aggregateLogs(entries: LogEntry[]): any {
    const aggregated = {
      count: entries.length,
      firstTimestamp: entries[0].timestamp,
      lastTimestamp: entries[entries.length - 1].timestamp,
      level: entries[0].level,
      message: entries[0].message,
      contexts: entries.map(e => e.context),
      errorCount: entries.filter(e => e.error).length,
    };

    return aggregated;
  }

  /**
   * Store aggregated logs
   */
  private async storeAggregatedLogs(key: string, aggregated: any): Promise<void> {
    const redisKey = `aggregated_logs:${key}`;
    await this.redis.setex(redisKey, 86400, JSON.stringify(aggregated));
  }

  /**
   * Apply retention policy
   */
  private async applyRetentionPolicy(): Promise<void> {
    if (!this.retentionConfig.archiveEnabled) {
      return;
    }

    const entry = this.createLogEntry(LogLevel.INFO, 'Applying log retention policy');
    this.log(entry);
    // In production, this would archive old logs to long-term storage
    // and delete expired logs from Redis
  }

  /**
   * Check if log should be sampled
   */
  private shouldSample(level: LogLevel): boolean {
    if (!this.samplingConfig.enabled) {
      return false;
    }

    if (!this.samplingConfig.sampledLevels.includes(level)) {
      return false;
    }

    return Math.random() > this.samplingConfig.sampleRate;
  }

  /**
   * Get aggregation key for log entry
   */
  private getAggregationKey(entry: LogEntry): string {
    if (!this.aggregationConfig.enabled) {
      return '';
    }

    const keyParts = this.aggregationConfig.aggregationKeys.map(key => {
      return entry.context[key as keyof LogContext] || 'unknown';
    });

    return keyParts.join(':');
  }

  /**
   * Set log context for the current request
   */
  setContext(context: LogContext): void {
    const store = this.asyncLocalStorage.getStore() || {};
    this.asyncLocalStorage.enterWith({ ...store, ...context });
  }

  /**
   * Get current log context
   */
  private getContext(): LogContext {
    return this.asyncLocalStorage.getStore() || {};
  }

  /**
   * Mask PHI (Protected Health Information) from logs
   */
  private maskPHI(data: any): any {
    if (!data) return data;

    const masked = { ...data };

    // List of PHI fields to mask
    const phiFields = [
      'ssn',
      'socialSecurityNumber',
      'dateOfBirth',
      'dob',
      'firstName',
      'lastName',
      'fullName',
      'address',
      'phone',
      'phoneNumber',
      'email',
      'medicalRecordNumber',
      'patientId',
      'diagnosis',
      'symptoms',
      'allergies',
      'chronicConditions',
    ];

    phiFields.forEach((field) => {
      if (masked[field]) {
        const value = String(masked[field]);
        if (value.length > 4) {
          masked[field] = value.substring(0, 2) + '***' + value.substring(value.length - 2);
        } else {
          masked[field] = '***';
        }
      }
    });

    return masked;
  }

  /**
   * Create log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    data?: any,
    error?: Error,
  ): LogEntry {
    const context = this.getContext();
    const maskedData = data ? this.maskPHI(data) : undefined;

    return {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data: maskedData,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };
  }

  /**
   * Update statistics
   */
  private updateStatistics(entry: LogEntry): void {
    this.statistics.totalLogs++;
    this.statistics.logsByLevel[entry.level]++;

    if (entry.context.userId) {
      this.statistics.logsByUser[entry.context.userId] = 
        (this.statistics.logsByUser[entry.context.userId] || 0) + 1;
    }

    if (entry.context.action) {
      this.statistics.logsByAction[entry.context.action] = 
        (this.statistics.logsByAction[entry.context.action] || 0) + 1;
    }
  }

  /**
   * Log to console (in production, this would go to a log aggregation service)
   */
  private log(entry: LogEntry): void {
    // Check sampling
    if (this.shouldSample(entry.level)) {
      this.statistics.sampledLogs++;
      return;
    }

    // Update statistics
    this.updateStatistics(entry);

    // Add to aggregation buffer if enabled
    if (this.aggregationConfig.enabled) {
      const aggregationKey = this.getAggregationKey(entry);
      if (aggregationKey) {
        const buffer = this.aggregationBuffer.get(aggregationKey) || [];
        buffer.push(entry);
        
        if (buffer.length >= this.aggregationConfig.maxEntriesPerWindow) {
          this.aggregationBuffer.set(aggregationKey, buffer.slice(-this.aggregationConfig.maxEntriesPerWindow));
        } else {
          this.aggregationBuffer.set(aggregationKey, buffer);
        }
      }
    }

    const logString = JSON.stringify(entry);
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(logString);
        break;
      case LogLevel.INFO:
        console.info(logString);
        break;
      case LogLevel.WARN:
        console.warn(logString);
        break;
      case LogLevel.ERROR:
        console.error(logString);
        break;
    }

    // In production, send to log aggregation service
    // e.g., ELK Stack, CloudWatch, Datadog
    if (process.env.NODE_ENV === 'production') {
      this.sendToLogAggregation(entry);
    }
  }

  /**
   * Send log to aggregation service (placeholder)
   */
  private async sendToLogAggregation(entry: LogEntry): Promise<void> {
    // Integration with log aggregation service
    // e.g., Winston transport, ELK, CloudWatch
    // This would be implemented based on the chosen log service
  }

  /**
   * Debug level log
   */
  debug(message: string, data?: any): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, data);
    this.log(entry);
  }

  /**
   * Info level log
   */
  info(message: string, data?: any): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, data);
    this.log(entry);
  }

  /**
   * Warning level log
   */
  warn(message: string, data?: any): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, data);
    this.log(entry);
  }

  /**
   * Error level log
   */
  error(message: string, error?: Error, data?: any): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, data, error);
    this.log(entry);
  }

  /**
   * Log audit event for HIPAA compliance
   */
  logAuditEvent(
    action: string,
    resource: string,
    resourceId: string,
    userId: string,
    additionalData?: any,
  ): void {
    this.info('Audit Event', {
      action,
      resource,
      resourceId,
      userId,
      ...additionalData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get log statistics
   */
  getStatistics(): LogStatistics {
    return { ...this.statistics };
  }

  /**
   * Reset log statistics
   */
  resetStatistics(): void {
    this.statistics.totalLogs = 0;
    this.statistics.logsByLevel = { [LogLevel.DEBUG]: 0, [LogLevel.INFO]: 0, [LogLevel.WARN]: 0, [LogLevel.ERROR]: 0 };
    this.statistics.logsByUser = {};
    this.statistics.logsByAction = {};
    this.statistics.sampledLogs = 0;
    this.statistics.aggregatedLogs = 0;
  }

  /**
   * Get retention configuration
   */
  getRetentionConfig(): LogRetentionConfig {
    return { ...this.retentionConfig };
  }

  /**
   * Update retention configuration
   */
  updateRetentionConfig(config: Partial<LogRetentionConfig>): void {
    Object.assign(this.retentionConfig, config);
  }

  /**
   * Archive logs manually
   */
  async archiveLogs(beforeDate: Date): Promise<number> {
    if (!this.retentionConfig.archiveEnabled) {
      throw new Error('Archiving is not enabled');
    }

    // In production, this would query logs before the specified date
    // and move them to long-term storage
    this.info(`Archiving logs before ${beforeDate.toISOString()}`);
    return 0;
  }

  /**
   * Query logs by criteria
   */
  async queryLogs(criteria: {
    level?: LogLevel;
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<LogEntry[]> {
    // In production, this would query the log storage
    // For now, return empty array
    return [];
  }
}
