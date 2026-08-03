/**
 * Observer Pattern Implementation with Event Persistence and Replay
 * Implements publish-subscribe pattern for real-time updates
 * Used for appointment status changes, video call events, vital sign alerts
 * Enhanced with event persistence, replay, and filtering
 */

import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

type EventHandler<T = any> = (data: T) => void | Promise<void>;

export interface StoredEvent {
  id: string;
  eventType: string;
  data: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface EventFilter {
  eventType?: string | string[];
  startTime?: Date;
  endTime?: Date;
  metadataFilter?: Record<string, any>;
}

interface Subscription {
  id: string;
  handler: EventHandler;
  once?: boolean;
  filter?: EventFilter;
}

@Injectable()
export class ObserverService {
  private readonly logger = new Logger(ObserverService.name);
  private readonly eventHandlers = new Map<string, Subscription[]>();
  private subscriptionCounter = 0;
  private readonly redis: Redis;
  private readonly enablePersistence: boolean = true;
  private readonly eventRetentionMs: number = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });

    this.startEventCleanupScheduler();
  }

  /**
   * Start event cleanup scheduler
   */
  private startEventCleanupScheduler(): void {
    // Clean up old events every hour
    setInterval(async () => {
      await this.cleanupOldEvents();
    }, 3600000);
  }

  /**
   * Clean up old events from storage
   */
  private async cleanupOldEvents(): Promise<void> {
    try {
      const keys = await this.redis.keys('event:*');
      const now = Date.now();
      let cleanedCount = 0;

      for (const key of keys) {
        const value = await this.redis.get(key);
        if (!value) continue;

        const event = JSON.parse(value) as StoredEvent;
        const eventAge = now - new Date(event.timestamp).getTime();

        if (eventAge > this.eventRetentionMs) {
          await this.redis.del(key);
          cleanedCount++;
        }
      }

      this.logger.log(`Cleaned up ${cleanedCount} old events`);
    } catch (error) {
      this.logger.error('Failed to cleanup old events:', error);
    }
  }

  /**
   * Subscribe to an event
   * @param event - Event name
   * @param handler - Event handler function
   * @param options - Subscription options
   * @returns Subscription ID
   */
  on<T = any>(
    event: string,
    handler: EventHandler<T>,
    options?: { once?: boolean; filter?: EventFilter },
  ): string {
    const subscriptionId = `sub_${++this.subscriptionCounter}`;

    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }

    this.eventHandlers.get(event)!.push({
      id: subscriptionId,
      handler,
      once: options?.once,
      filter: options?.filter,
    });

    this.logger.debug(`Subscribed to event: ${event} (ID: ${subscriptionId})`);
    return subscriptionId;
  }

  /**
   * Subscribe to event once (auto-unsubscribe after first trigger)
   */
  once<T = any>(event: string, handler: EventHandler<T>): string {
    return this.on(event, handler, { once: true });
  }

  /**
   * Subscribe with filter
   */
  onFiltered<T = any>(
    event: string,
    handler: EventHandler<T>,
    filter: EventFilter,
  ): string {
    return this.on(event, handler, { filter });
  }

  /**
   * Unsubscribe from an event
   * @param event - Event name
   * @param subscriptionId - Subscription ID
   */
  off(event: string, subscriptionId: string): void {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return;

    const index = handlers.findIndex((sub) => sub.id === subscriptionId);
    if (index !== -1) {
      handlers.splice(index, 1);
      this.logger.debug(`Unsubscribed from event: ${event} (ID: ${subscriptionId})`);
    }

    if (handlers.length === 0) {
      this.eventHandlers.delete(event);
    }
  }

  /**
   * Unsubscribe all handlers for an event
   */
  removeAllListeners(event: string): void {
    this.eventHandlers.delete(event);
    this.logger.debug(`Removed all listeners for event: ${event}`);
  }

  /**
   * Emit an event to all subscribers with persistence
   * @param event - Event name
   * @param data - Event data
   * @param metadata - Optional metadata
   */
  async emit<T = any>(event: string, data?: T, metadata?: Record<string, any>): Promise<void> {
    // Persist event if enabled
    if (this.enablePersistence) {
      await this.persistEvent(event, data, metadata);
    }

    const handlers = this.eventHandlers.get(event);
    if (!handlers || handlers.length === 0) {
      this.logger.debug(`No listeners for event: ${event}`);
      return;
    }

    this.logger.debug(`Emitting event: ${event} to ${handlers.length} listeners`);

    // Execute handlers in parallel with filter support
    const handlersToRemove: string[] = [];

    await Promise.all(
      handlers.map(async (subscription) => {
        try {
          // Check filter if present
          if (subscription.filter && !this.matchesFilter(event, data, subscription.filter)) {
            return;
          }

          await subscription.handler(data);

          if (subscription.once) {
            handlersToRemove.push(subscription.id);
          }
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            `Error in event handler for ${event}: ${err.message}`,
          );
        }
      }),
    );

    // Remove one-time subscriptions
    handlersToRemove.forEach((id) => this.off(event, id));
  }

  /**
   * Persist event to Redis
   */
  private async persistEvent(event: string, data: any, metadata?: Record<string, any>): Promise<void> {
    try {
      const storedEvent: StoredEvent = {
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventType: event,
        data,
        timestamp: new Date(),
        metadata,
      };

      const key = `event:${storedEvent.id}`;
      const value = JSON.stringify(storedEvent);
      await this.redis.setex(key, this.eventRetentionMs / 1000, value); // Convert to seconds

      // Add to event index
      await this.redis.sadd(`event_index:${event}`, storedEvent.id);
      await this.redis.expire(`event_index:${event}`, this.eventRetentionMs / 1000);
    } catch (error) {
      this.logger.error('Failed to persist event:', error);
    }
  }

  /**
   * Check if event matches filter
   */
  private matchesFilter(event: string, data: any, filter: EventFilter): boolean {
    // Check event type filter
    if (filter.eventType) {
      const types = Array.isArray(filter.eventType) ? filter.eventType : [filter.eventType];
      if (!types.includes(event)) {
        return false;
      }
    }

    // Check metadata filter
    if (filter.metadataFilter && data) {
      for (const [key, value] of Object.entries(filter.metadataFilter)) {
        if (data[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Replay events from storage
   */
  async replayEvents(filter: EventFilter, handler: EventHandler): Promise<number> {
    this.logger.log('Replaying events with filter:', filter);

    let replayedCount = 0;
    const keys = await this.redis.keys('event:*');

    for (const key of keys) {
      const value = await this.redis.get(key);
      if (!value) continue;

      const event = JSON.parse(value) as StoredEvent;

      // Check if event matches filter
      if (this.matchesFilter(event.eventType, event.data, filter)) {
        try {
          await handler(event.data);
          replayedCount++;
        } catch (error) {
          this.logger.error(`Error replaying event ${event.id}:`, error);
        }
      }
    }

    this.logger.log(`Replayed ${replayedCount} events`);
    return replayedCount;
  }

  /**
   * Get stored events
   */
  async getEvents(filter: EventFilter): Promise<StoredEvent[]> {
    const events: StoredEvent[] = [];
    const keys = await this.redis.keys('event:*');

    for (const key of keys) {
      const value = await this.redis.get(key);
      if (!value) continue;

      const event = JSON.parse(value) as StoredEvent;

      if (this.matchesFilter(event.eventType, event.data, filter)) {
        events.push(event);
      }
    }

    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * Clear all stored events
   */
  async clearEvents(): Promise<void> {
    const keys = await this.redis.keys('event:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
      this.logger.log(`Cleared ${keys.length} events`);
    }
  }

  /**
   * Get number of subscribers for an event
   */
  listenerCount(event: string): number {
    return this.eventHandlers.get(event)?.length || 0;
  }

  /**
   * Get all event names with active subscribers
   */
  eventNames(): string[] {
    return Array.from(this.eventHandlers.keys());
  }
}

/**
 * Typed Event Emitter for specific domains
 */
export class TypedEventEmitter<TEvents extends Record<string, any>> {
  private readonly observer = new ObserverService();

  on<K extends keyof TEvents>(
    event: K,
    handler: EventHandler<TEvents[K]>,
  ): string {
    return this.observer.on(event as string, handler);
  }

  once<K extends keyof TEvents>(
    event: K,
    handler: EventHandler<TEvents[K]>,
  ): string {
    return this.observer.once(event as string, handler);
  }

  off(event: keyof TEvents, subscriptionId: string): void {
    this.observer.off(event as string, subscriptionId);
  }

  async emit<K extends keyof TEvents>(event: K, data: TEvents[K]): Promise<void> {
    return this.observer.emit(event as string, data);
  }
}

/**
 * Real-time events for telemedicine platform
 */
export interface TelemedicineEvents {
  // Appointment events
  'appointment.created': { appointmentId: string; patientId: string; doctorId: string };
  'appointment.confirmed': { appointmentId: string; scheduledAt: Date };
  'appointment.cancelled': { appointmentId: string; reason: string };
  'appointment.started': { appointmentId: string; videoCallId: string };
  'appointment.completed': { appointmentId: string; duration: number };

  // Video call events
  'videocall.started': { appointmentId: string; roomId: string };
  'videocall.ended': { appointmentId: string; duration: number; qualityScore: number };
  'videocall.quality-dropped': { appointmentId: string; qualityScore: number };
  'videocall.reconnecting': { appointmentId: string };

  // Vital sign events
  'vitals.received': { patientId: string; deviceId: string; vitalSigns: any };
  'vitals.abnormal': { patientId: string; vitalSignType: string; value: number; severity: string };
  'vitals.alert': { alertId: string; patientId: string; severity: string };

  // Medical record events
  'medical-record.created': { recordId: string; patientId: string; doctorId: string };
  'medical-record.updated': { recordId: string; patientId: string };

  // Prescription events
  'prescription.created': { prescriptionId: string; patientId: string; doctorId: string };
  'prescription.dispensed': { prescriptionId: string; patientId: string };

  // Payment events
  'payment.completed': { paymentId: string; appointmentId: string; amount: number };
  'payment.failed': { paymentId: string; appointmentId: string; reason: string };
}

export class TelemedicineEventEmitter extends TypedEventEmitter<TelemedicineEvents> {}
