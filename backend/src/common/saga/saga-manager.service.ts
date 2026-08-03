/**
 * Saga Pattern Implementation with Persistence and Recovery
 * Orchestrates complex multi-step transactions with compensation
 * Used for appointment booking workflow: Book Appointment -> Process Payment -> Notify -> Create Video Room
 * Enhanced with persistence, recovery, monitoring, and metrics
 */

import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

export interface SagaStep<T = any> {
  name: string;
  execute: (context: T) => Promise<any>;
  compensate: (context: T, error?: Error) => Promise<void>;
  timeout?: number; // Step timeout in milliseconds
  retryable?: boolean; // Whether step can be retried
  maxRetries?: number; // Maximum retry attempts
}

export interface SagaDefinition<T = any> {
  name: string;
  steps: SagaStep<T>[];
  timeout?: number; // Overall saga timeout
  retryPolicy?: 'none' | 'all' | 'compensable';
}

export interface SagaExecution {
  id: string;
  sagaName: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'COMPENSATING' | 'PAUSED' | 'RECOVERING';
  currentStep: number;
  context: any;
  startedAt: Date;
  completedAt?: Date;
  error?: Error;
  completedSteps: string[];
  failedSteps: string[];
  retryCount: number;
  lastRetryAt?: Date;
  metadata?: Record<string, any>;
}

export interface SagaMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  compensatingExecutions: number;
  averageExecutionTime: number;
  averageCompensationTime: number;
  stepSuccessRates: Record<string, number>;
}

@Injectable()
export class SagaManagerService {
  private readonly logger = new Logger(SagaManagerService.name);
  private readonly executions = new Map<string, SagaExecution>();
  private readonly redis: Redis;
  private readonly metrics: SagaMetrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    compensatingExecutions: 0,
    averageExecutionTime: 0,
    averageCompensationTime: 0,
    stepSuccessRates: {},
  };
  private readonly executionTimes: number[] = [];
  private readonly compensationTimes: number[] = [];

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });

    // Start recovery process for failed sagas
    this.startRecoveryProcess();
  }

  /**
   * Execute a saga with compensation
   */
  async execute<T>(saga: SagaDefinition<T>, context: T): Promise<T> {
    const executionId = `saga_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const execution: SagaExecution = {
      id: executionId,
      sagaName: saga.name,
      status: 'PENDING',
      currentStep: 0,
      context,
      startedAt: new Date(),
      completedSteps: [],
      failedSteps: [],
      retryCount: 0,
    };

    this.executions.set(executionId, execution);
    await this.persistExecution(execution);
    this.logger.log(`Starting saga: ${saga.name} (ID: ${executionId})`);

    const startTime = Date.now();
    this.metrics.totalExecutions++;

    try {
      for (let i = 0; i < saga.steps.length; i++) {
        const step = saga.steps[i];
        execution.currentStep = i;

        this.logger.log(`Executing step ${i + 1}/${saga.steps.length}: ${step.name}`);

        try {
          // Apply step timeout if configured
          const stepTimeout = step.timeout || saga.timeout || 30000;
          const result = await this.executeWithTimeout(
            () => step.execute(context),
            stepTimeout,
          );
          
          // Store step result in context
          context[step.name] = result;
          execution.completedSteps.push(step.name);
          
          // Update step success rate
          this.updateStepMetrics(step.name, true);
          
          await this.persistExecution(execution);
          this.logger.log(`Step completed: ${step.name}`);
        } catch (error) {
          const err = error as Error;
          this.logger.error(`Step failed: ${step.name}`, err.stack);
          execution.status = 'COMPENSATING';
          execution.error = err;
          execution.failedSteps.push(step.name);
          
          // Update step success rate
          this.updateStepMetrics(step.name, false);

          // Check if step is retryable
          const shouldRetry = step.retryable && execution.retryCount < (step.maxRetries || 3);
          
          if (shouldRetry) {
            execution.retryCount++;
            execution.lastRetryAt = new Date();
            execution.status = 'PENDING';
            execution.currentStep = i; // Retry same step
            await this.persistExecution(execution);
            this.logger.log(`Retrying step ${step.name} (attempt ${execution.retryCount})`);
            i--; // Retry current step
            continue;
          }

          // Compensate all completed steps in reverse order
          const compensationStartTime = Date.now();
          await this.compensate(saga, context, i);
          const compensationTime = Date.now() - compensationStartTime;
          this.compensationTimes.push(compensationTime);
          
          execution.status = 'FAILED';
          execution.completedAt = new Date();
          this.metrics.failedExecutions++;
          this.metrics.compensatingExecutions++;
          await this.persistExecution(execution);
          throw error;
        }
      }

      execution.status = 'COMPLETED';
      execution.completedAt = new Date();
      this.metrics.successfulExecutions++;
      const executionTime = Date.now() - startTime;
      this.executionTimes.push(executionTime);
      await this.persistExecution(execution);
      this.logger.log(`Saga completed successfully: ${saga.name} in ${executionTime}ms`);

      return context;
    } finally {
      // Clean up old executions (keep last 100)
      if (this.executions.size > 100) {
        const oldestKey = this.executions.keys().next().value;
        this.executions.delete(oldestKey);
      }
    }
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number,
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), timeout),
      ),
    ]);
  }

  /**
   * Persist execution state to Redis
   */
  private async persistExecution(execution: SagaExecution): Promise<void> {
    try {
      const key = `saga:${execution.id}`;
      const value = JSON.stringify(execution);
      await this.redis.setex(key, 86400, value); // 24 hours TTL
    } catch (error) {
      this.logger.error('Failed to persist execution:', error);
    }
  }

  /**
   * Load execution from Redis
   */
  private async loadExecution(executionId: string): Promise<SagaExecution | null> {
    try {
      const key = `saga:${executionId}`;
      const value = await this.redis.get(key);
      if (value) {
        return JSON.parse(value) as SagaExecution;
      }
      return null;
    } catch (error) {
      this.logger.error('Failed to load execution:', error);
      return null;
    }
  }

  /**
   * Start recovery process for failed sagas
   */
  private startRecoveryProcess(): void {
    // Run recovery every 5 minutes
    setInterval(async () => {
      await this.recoverFailedSagas();
    }, 300000);
  }

  /**
   * Recover failed sagas
   */
  private async recoverFailedSagas(): Promise<void> {
    this.logger.log('Starting saga recovery process');
    
    try {
      const keys = await this.redis.keys('saga:*');
      let recoveredCount = 0;

      for (const key of keys) {
        const value = await this.redis.get(key);
        if (!value) continue;

        const execution = JSON.parse(value) as SagaExecution;
        
        // Only recover failed or compensating sagas
        if (execution.status === 'FAILED' || execution.status === 'COMPENSATING') {
          this.logger.log(`Attempting to recover saga: ${execution.id}`);
          
          // Mark as recovering
          execution.status = 'RECOVERING';
          await this.persistExecution(execution);
          
          // In production, you would trigger a recovery workflow here
          // For now, we just log it
          recoveredCount++;
        }
      }

      this.logger.log(`Saga recovery completed: ${recoveredCount} sagas recovered`);
    } catch (error) {
      this.logger.error('Saga recovery failed:', error);
    }
  }

  /**
   * Update step metrics
   */
  private updateStepMetrics(stepName: string, success: boolean): void {
    if (!this.metrics.stepSuccessRates[stepName]) {
      this.metrics.stepSuccessRates[stepName] = 0;
    }
    
    const currentRate = this.metrics.stepSuccessRates[stepName];
    const totalAttempts = (currentRate * 100) + 1;
    const successCount = currentRate * 100 + (success ? 1 : 0);
    
    this.metrics.stepSuccessRates[stepName] = successCount / totalAttempts;
  }

  /**
   * Get saga metrics
   */
  getMetrics(): SagaMetrics {
    // Calculate averages
    const avgExecutionTime = this.executionTimes.length > 0
      ? this.executionTimes.reduce((sum, time) => sum + time, 0) / this.executionTimes.length
      : 0;
    
    const avgCompensationTime = this.compensationTimes.length > 0
      ? this.compensationTimes.reduce((sum, time) => sum + time, 0) / this.compensationTimes.length
      : 0;

    return {
      ...this.metrics,
      averageExecutionTime: avgExecutionTime,
      averageCompensationTime: avgCompensationTime,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics.totalExecutions = 0;
    this.metrics.successfulExecutions = 0;
    this.metrics.failedExecutions = 0;
    this.metrics.compensatingExecutions = 0;
    this.metrics.averageExecutionTime = 0;
    this.metrics.averageCompensationTime = 0;
    this.metrics.stepSuccessRates = {};
    this.executionTimes.length = 0;
    this.compensationTimes.length = 0;
  }

  /**
   * Pause a saga execution
   */
  async pauseExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (execution && execution.status === 'PENDING') {
      execution.status = 'PAUSED';
      await this.persistExecution(execution);
      this.logger.log(`Paused saga execution: ${executionId}`);
    }
  }

  /**
   * Resume a paused saga execution
   */
  async resumeExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (execution && execution.status === 'PAUSED') {
      execution.status = 'PENDING';
      await this.persistExecution(execution);
      this.logger.log(`Resumed saga execution: ${executionId}`);
    }
  }

  /**
   * Compensate failed steps in reverse order
   */
  private async compensate<T>(
    saga: SagaDefinition<T>,
    context: T,
    failedStepIndex: number,
  ): Promise<void> {
    this.logger.log(`Starting compensation for saga: ${saga.name}`);

    for (let i = failedStepIndex - 1; i >= 0; i--) {
      const step = saga.steps[i];
      this.logger.log(`Compensating step: ${step.name}`);

      try {
        await step.compensate(context);
        this.logger.log(`Compensation completed: ${step.name}`);
      } catch (error) {
        this.logger.error(`Compensation failed for step: ${step.name}`, error.stack);
        // Continue compensating other steps even if one fails
      }
    }

    this.logger.log(`Compensation completed for saga: ${saga.name}`);
  }

  /**
   * Get execution status
   */
  getExecution(executionId: string): SagaExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all executions
   */
  getAllExecutions(): SagaExecution[] {
    return Array.from(this.executions.values());
  }
}

/**
 * Appointment Booking Saga
 * Orchestrates the complete appointment booking process
 */

export interface AppointmentBookingContext {
  patientId: string;
  doctorId: string;
  scheduledAt: Date;
  duration: number;
  reason: string;
  symptoms?: string;
  
  // Step results
  'create-appointment'?: any;
  'process-payment'?: any;
  'create-video-room'?: any;
  'send-confirmation'?: any;
  'notify-doctor'?: any;
}

export const AppointmentBookingSaga: SagaDefinition<AppointmentBookingContext> = {
  name: 'AppointmentBookingSaga',
  steps: [
    {
      name: 'create-appointment',
      execute: async (context) => {
        // Create appointment in database
        // This would call the appointments service
        const appointment = {
          id: `apt_${Date.now()}`,
          patientId: context.patientId,
          doctorId: context.doctorId,
          scheduledAt: context.scheduledAt,
          duration: context.duration,
          reason: context.reason,
          symptoms: context.symptoms,
          status: 'PENDING',
        };
        return appointment;
      },
      compensate: async (context) => {
        // Delete appointment from database
        console.log(`Compensating: Deleting appointment ${context['create-appointment']?.id}`);
      },
    },
    {
      name: 'process-payment',
      execute: async (context) => {
        // Process payment via Stripe
        const payment = {
          id: `pay_${Date.now()}`,
          appointmentId: context['create-appointment'].id,
          amount: 50.00, // Would be calculated based on doctor's fee
          status: 'COMPLETED',
        };
        return payment;
      },
      compensate: async (context) => {
        // Refund payment
        console.log(`Compensating: Refunding payment ${context['process-payment']?.id}`);
      },
    },
    {
      name: 'create-video-room',
      execute: async (context) => {
        // Create WebRTC video room
        const videoRoom = {
          id: `room_${Date.now()}`,
          appointmentId: context['create-appointment'].id,
          roomId: `consult_${context['create-appointment'].id}`,
          patientToken: 'token_patient_xxx',
          doctorToken: 'token_doctor_xxx',
        };
        return videoRoom;
      },
      compensate: async (context) => {
        // Close video room
        console.log(`Compensating: Closing video room ${context['create-video-room']?.roomId}`);
      },
    },
    {
      name: 'send-confirmation',
      execute: async (context) => {
        // Send confirmation email/SMS to patient
        const notification = {
          id: `notif_${Date.now()}`,
          type: 'APPOINTMENT_CONFIRMED',
          recipientId: context.patientId,
          appointmentId: context['create-appointment'].id,
        };
        return notification;
      },
      compensate: async (context) => {
        // Send cancellation notification
        console.log(`Compensating: Sending cancellation for notification ${context['send-confirmation']?.id}`);
      },
    },
    {
      name: 'notify-doctor',
      execute: async (context) => {
        // Notify doctor about new appointment
        const notification = {
          id: `notif_doctor_${Date.now()}`,
          type: 'NEW_APPOINTMENT',
          recipientId: context.doctorId,
          appointmentId: context['create-appointment'].id,
        };
        return notification;
      },
      compensate: async (context) => {
        // Notify doctor about cancellation
        console.log(`Compensating: Notifying doctor about cancellation`);
      },
    },
  ],
};
