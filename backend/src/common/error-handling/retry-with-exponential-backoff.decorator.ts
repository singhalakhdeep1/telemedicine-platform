/**
 * Retry with Exponential Backoff Decorator with Fallback Mechanisms
 * Implements retry pattern with exponential backoff for resilient operations
 * Used for video call connections, external API calls, etc.
 * Enhanced with fallback mechanisms and error classification
 */

import { Logger } from '@nestjs/common';

export enum ErrorCategory {
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE',
  EXTERNAL_API = 'EXTERNAL_API',
  VALIDATION = 'VALIDATION',
  AUTHORIZATION = 'AUTHORIZATION',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  UNKNOWN = 'UNKNOWN',
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface ClassifiedError extends Error {
  category: ErrorCategory;
  severity: ErrorSeverity;
  retryable: boolean;
  code?: string;
  timestamp: Date;
  context?: Record<string, any>;
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: ClassifiedError) => void;
  fallback?: (error: ClassifiedError) => any;
  classifyError?: (error: Error) => ClassifiedError;
}

export function RetryWithExponentialBackoff(options: RetryOptions = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    retryableErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'],
    onRetry,
    fallback,
    classifyError = defaultErrorClassifier,
  } = options;

  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const logger = new Logger(`${target.constructor.name}.${propertyKey}`);

    descriptor.value = async function (...args: any[]) {
      let lastError: ClassifiedError;
      let delay = initialDelay;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          const classifiedError = classifyError(error as Error);
          lastError = classifiedError;

          // Check if error is retryable
          const isRetryable =
            classifiedError.retryable ||
            retryableErrors.includes(classifiedError.code || '');

          if (attempt === maxRetries || !isRetryable) {
            logger.error(
              `Operation failed after ${attempt + 1} attempts: ${classifiedError.message} [${classifiedError.category}/${classifiedError.severity}]`,
            );

            // Try fallback if available
            if (fallback) {
              logger.log('Attempting fallback operation');
              try {
                return await fallback(classifiedError);
              } catch (fallbackError) {
                logger.error('Fallback operation failed:', fallbackError);
                throw lastError;
              }
            }

            throw lastError;
          }

          logger.warn(
            `Attempt ${attempt + 1} failed, retrying in ${delay}ms: ${classifiedError.message} [${classifiedError.category}]`,
          );

          if (onRetry) {
            onRetry(attempt + 1, classifiedError);
          }

          // Wait with exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Calculate next delay with exponential backoff
          delay = Math.min(delay * backoffMultiplier, maxDelay);
        }
      }

      throw lastError;
    };

    return descriptor;
  };
}

/**
 * Default error classifier
 */
function defaultErrorClassifier(error: Error): ClassifiedError {
  const err = error as any;
  const code = err.code || err.name || 'UNKNOWN';
  
  let category = ErrorCategory.UNKNOWN;
  let severity = ErrorSeverity.MEDIUM;
  let retryable = false;

  // Network errors
  if (['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ENETUNREACH'].includes(code)) {
    category = ErrorCategory.NETWORK;
    severity = ErrorSeverity.HIGH;
    retryable = true;
  }

  // Database errors
  if (code.includes('SQL') || code.includes('DATABASE') || code === 'CONNECTION_ERROR') {
    category = ErrorCategory.DATABASE;
    severity = ErrorSeverity.HIGH;
    retryable = true;
  }

  // External API errors
  if (code === 'HTTP_ERROR' || code === 'API_ERROR' || err.status >= 500) {
    category = ErrorCategory.EXTERNAL_API;
    severity = err.status >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
    retryable = err.status >= 500;
  }

  // Validation errors
  if (code === 'VALIDATION_ERROR' || err.status === 400) {
    category = ErrorCategory.VALIDATION;
    severity = ErrorSeverity.LOW;
    retryable = false;
  }

  // Authorization errors
  if (code === 'AUTH_ERROR' || err.status === 401 || err.status === 403) {
    category = ErrorCategory.AUTHORIZATION;
    severity = ErrorSeverity.HIGH;
    retryable = false;
  }

  return {
    ...error,
    category,
    severity,
    retryable,
    code,
    timestamp: new Date(),
  };
}

/**
 * Circuit Breaker Pattern
 * Prevents cascading failures by stopping calls to failing services
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
  monitoringPeriod?: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;

  private readonly logger = new Logger(CircuitBreaker.name);

  constructor(private options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minute
      monitoringPeriod: 10000, // 10 seconds
      ...options,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.logger.log('Circuit breaker transitioning to HALF_OPEN');
      } else {
        throw new Error('Circuit breaker is OPEN - calls are blocked');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold!) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.logger.log('Circuit breaker transitioning to CLOSED');
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.options.failureThreshold!) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = new Date(
        Date.now() + this.options.timeout!,
      );
      this.logger.warn('Circuit breaker transitioning to OPEN');
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.nextAttemptTime) return false;
    return new Date() >= this.nextAttemptTime;
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
    this.logger.log('Circuit breaker reset to CLOSED');
  }
}

/**
 * Bulkhead Pattern
 * Isolates resources to prevent cascading failures
 */

export class Bulkhead {
  private activeTasks = 0;
  private queue: Array<() => void> = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueue: number = 10,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeTasks >= this.maxConcurrent) {
      if (this.queue.length >= this.maxQueue) {
        throw new Error('Bulkhead queue is full');
      }

      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }

    this.activeTasks++;

    try {
      return await fn();
    } finally {
      this.activeTasks--;

      // Process next task in queue
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next?.();
      }
    }
  }

  getStats() {
    return {
      activeTasks: this.activeTasks,
      queuedTasks: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      maxQueue: this.maxQueue,
    };
  }
}
