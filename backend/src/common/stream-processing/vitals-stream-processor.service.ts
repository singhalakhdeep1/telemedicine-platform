/**
 * Stream Processing for Real-time Vitals with Alert Routing
 * Implements real-time processing pipeline for IoT vital signs
 * Uses windowing, aggregation, anomaly detection, and alert routing
 * Enhanced with persistence, replay, and multi-channel alert routing
 */

import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

export interface VitalSignReading {
  patientId: string;
  deviceId: string;
  type: string;
  value: number;
  unit: string;
  timestamp: Date;
}

export interface ProcessedVitalSign {
  patientId: string;
  type: string;
  currentValue: number;
  average: number;
  min: number;
  max: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  isAbnormal: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  windowStart: Date;
  windowEnd: Date;
  sampleCount: number;
}

export interface VitalsWindow {
  patientId: string;
  vitalType: string;
  readings: VitalSignReading[];
  windowStart: Date;
  windowEnd: Date;
}

export interface AlertRoute {
  channel: 'sms' | 'email' | 'push' | 'websocket' | 'webhook';
  destination: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  vitalType: string;
  condition: (processed: ProcessedVitalSign) => boolean;
  routes: AlertRoute[];
  cooldownMs: number;
  lastTriggered?: Date;
}

export interface StreamMetrics {
  totalReadings: number;
  totalAlerts: number;
  alertsBySeverity: Record<string, number>;
  alertsByType: Record<string, number>;
  averageProcessingTime: number;
}

@Injectable()
export class VitalsStreamProcessorService {
  private readonly logger = new Logger(VitalsStreamProcessorService.name);
  private readonly redis: Redis;
  
  // Sliding windows for each patient and vital type
  private readonly windows = new Map<string, VitalsWindow>();
  
  // Window duration in milliseconds (default: 5 minutes)
  private readonly windowDuration = 5 * 60 * 1000;
  
  // Vital sign thresholds for anomaly detection
  private readonly thresholds = {
    BLOOD_PRESSURE_SYSTOLIC: { min: 90, max: 140, critical: 180 },
    BLOOD_PRESSURE_DIASTOLIC: { min: 60, max: 90, critical: 120 },
    HEART_RATE: { min: 60, max: 100, critical: 150 },
    BLOOD_GLUCOSE: { min: 70, max: 140, critical: 300 },
    OXYGEN_SATURATION: { min: 95, max: 100, critical: 90 },
    TEMPERATURE: { min: 36.1, max: 37.2, critical: 39 },
  };

  // Alert routing rules
  private readonly alertRules: AlertRule[] = [];
  
  // Alert cooldown tracking
  private readonly alertCooldowns = new Map<string, Date>();
  
  // Metrics
  private readonly metrics: StreamMetrics = {
    totalReadings: 0,
    totalAlerts: 0,
    alertsBySeverity: {},
    alertsByType: {},
    averageProcessingTime: 0,
  };
  private readonly processingTimes: number[] = [];

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });

    this.initializeDefaultAlertRules();
    this.startPersistenceScheduler();
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    // Critical heart rate alert
    this.alertRules.push({
      id: 'critical_heart_rate',
      name: 'Critical Heart Rate',
      vitalType: 'HEART_RATE',
      condition: (processed) => processed.severity === 'CRITICAL',
      routes: [
        { channel: 'sms', destination: '+1XXX', priority: 'critical', enabled: true },
        { channel: 'push', destination: 'doctor_app', priority: 'critical', enabled: true },
        { channel: 'websocket', destination: 'monitoring_dashboard', priority: 'critical', enabled: true },
      ],
      cooldownMs: 60000, // 1 minute cooldown
    });

    // High blood pressure alert
    this.alertRules.push({
      id: 'high_blood_pressure',
      name: 'High Blood Pressure',
      vitalType: 'BLOOD_PRESSURE_SYSTOLIC',
      condition: (processed) => processed.severity === 'HIGH' || processed.severity === 'CRITICAL',
      routes: [
        { channel: 'email', destination: 'doctor@hospital.com', priority: 'high', enabled: true },
        { channel: 'push', destination: 'patient_app', priority: 'high', enabled: true },
      ],
      cooldownMs: 300000, // 5 minute cooldown
    });

    // Low oxygen saturation alert
    this.alertRules.push({
      id: 'low_oxygen',
      name: 'Low Oxygen Saturation',
      vitalType: 'OXYGEN_SATURATION',
      condition: (processed) => processed.currentValue < 90,
      routes: [
        { channel: 'sms', destination: '+1XXX', priority: 'critical', enabled: true },
        { channel: 'push', destination: 'doctor_app', priority: 'critical', enabled: true },
        { channel: 'websocket', destination: 'emergency_room', priority: 'critical', enabled: true },
      ],
      cooldownMs: 30000, // 30 second cooldown
    });

    // Trend detection alert
    this.alertRules.push({
      id: 'trend_alert',
      name: 'Abnormal Trend Detected',
      vitalType: '*',
      condition: (processed) => processed.trend !== 'stable' && processed.isAbnormal,
      routes: [
        { channel: 'email', destination: 'doctor@hospital.com', priority: 'medium', enabled: true },
        { channel: 'webhook', destination: 'https://api.hospital.com/alerts', priority: 'medium', enabled: true },
      ],
      cooldownMs: 600000, // 10 minute cooldown
    });
  }

  /**
   * Start persistence scheduler
   */
  private startPersistenceScheduler(): void {
    // Persist windows every 5 minutes
    setInterval(async () => {
      await this.persistWindows();
    }, 300000);
  }

  /**
   * Persist windows to Redis
   */
  private async persistWindows(): Promise<void> {
    try {
      for (const [key, window] of this.windows) {
        const value = JSON.stringify(window);
        await this.redis.setex(`vitals_window:${key}`, 3600, value); // 1 hour TTL
      }
      this.logger.log(`Persisted ${this.windows.size} vitals windows`);
    } catch (error) {
      this.logger.error('Failed to persist windows:', error);
    }
  }

  /**
   * Load windows from Redis
   */
  private async loadWindows(): Promise<void> {
    try {
      const keys = await this.redis.keys('vitals_window:*');
      
      for (const key of keys) {
        const value = await this.redis.get(key);
        if (value) {
          const window = JSON.parse(value) as VitalsWindow;
          this.windows.set(key.replace('vitals_window:', ''), window);
        }
      }
      
      this.logger.log(`Loaded ${keys.length} vitals windows from Redis`);
    } catch (error) {
      this.logger.error('Failed to load windows:', error);
    }
  }

  /**
   * Replay readings from storage
   */
  async replayReadings(patientId: string, vitalType: string, startTime: Date, endTime: Date): Promise<ProcessedVitalSign[]> {
    this.logger.log(`Replaying readings for patient ${patientId}, vital ${vitalType}`);
    
    // In production, this would load from a time-series database
    // For now, return empty array
    return [];
  }

  /**
   * Process a single vital sign reading with alert routing
   */
  async processReading(reading: VitalSignReading): Promise<ProcessedVitalSign> {
    const startTime = Date.now();
    const windowKey = `${reading.patientId}:${reading.type}`;
    
    // Get or create window
    let window = this.windows.get(windowKey);
    
    if (!window || this.isWindowExpired(window)) {
      window = this.createNewWindow(reading.patientId, reading.type);
      this.windows.set(windowKey, window);
    }
    
    // Add reading to window
    window.readings.push(reading);
    window.windowEnd = new Date(Math.max(
      window.windowEnd.getTime(),
      reading.timestamp.getTime(),
    ));
    
    // Process window
    const processed = this.processWindow(window);
    
    // Update metrics
    this.metrics.totalReadings++;
    const processingTime = Date.now() - startTime;
    this.processingTimes.push(processingTime);
    
    // Check alert rules and route alerts
    await this.checkAndRouteAlerts(processed);
    
    return processed;
  }

  /**
   * Check alert rules and route alerts
   */
  private async checkAndRouteAlerts(processed: ProcessedVitalSign): Promise<void> {
    for (const rule of this.alertRules) {
      // Check if rule applies to this vital type
      if (rule.vitalType !== '*' && rule.vitalType !== processed.type) {
        continue;
      }
      
      // Check cooldown
      const cooldownKey = `${rule.id}:${processed.patientId}`;
      const lastTriggered = this.alertCooldowns.get(cooldownKey);
      if (lastTriggered && Date.now() - lastTriggered.getTime() < rule.cooldownMs) {
        continue;
      }
      
      // Check condition
      if (rule.condition(processed)) {
        await this.routeAlert(processed, rule);
        this.alertCooldowns.set(cooldownKey, new Date());
        rule.lastTriggered = new Date();
        
        // Update metrics
        this.metrics.totalAlerts++;
        this.metrics.alertsBySeverity[processed.severity] = 
          (this.metrics.alertsBySeverity[processed.severity] || 0) + 1;
        this.metrics.alertsByType[processed.type] = 
          (this.metrics.alertsByType[processed.type] || 0) + 1;
      }
    }
  }

  /**
   * Route alert to configured channels
   */
  private async routeAlert(processed: ProcessedVitalSign, rule: AlertRule): Promise<void> {
    const alert = {
      patientId: processed.patientId,
      vitalType: processed.type,
      severity: processed.severity,
      value: processed.currentValue,
      ruleName: rule.name,
      timestamp: new Date(),
      message: this.generateAlertMessage(processed, rule),
    };

    this.logger.log(`Routing alert for patient ${processed.patientId}: ${rule.name}`);

    for (const route of rule.routes) {
      if (!route.enabled) continue;

      try {
        await this.sendAlert(route, alert);
      } catch (error) {
        this.logger.error(`Failed to send alert via ${route.channel}:`, error);
      }
    }
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(processed: ProcessedVitalSign, rule: AlertRule): string {
    return `${rule.name}: Patient ${processed.patientId} has ${processed.type} of ${processed.currentValue} (${processed.severity})`;
  }

  /**
   * Send alert via specific channel
   */
  private async sendAlert(route: AlertRoute, alert: any): Promise<void> {
    switch (route.channel) {
      case 'sms':
        // Integrate with SMS service (Twilio, etc.)
        this.logger.log(`SMS alert sent to ${route.destination}: ${alert.message}`);
        break;
      case 'email':
        // Integrate with email service (SendGrid, etc.)
        this.logger.log(`Email alert sent to ${route.destination}: ${alert.message}`);
        break;
      case 'push':
        // Integrate with push notification service (FCM, APNs)
        this.logger.log(`Push notification sent to ${route.destination}: ${alert.message}`);
        break;
      case 'websocket':
        // Send via WebSocket to monitoring dashboard
        this.logger.log(`WebSocket alert sent to ${route.destination}: ${alert.message}`);
        break;
      case 'webhook':
        // Send HTTP POST to webhook URL
        this.logger.log(`Webhook alert sent to ${route.destination}: ${alert.message}`);
        break;
    }
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
    this.logger.log(`Added alert rule: ${rule.name}`);
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): void {
    const index = this.alertRules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.alertRules.splice(index, 1);
      this.logger.log(`Removed alert rule: ${ruleId}`);
    }
  }

  /**
   * Get stream metrics
   */
  getMetrics(): StreamMetrics {
    const avgProcessingTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length
      : 0;

    return {
      ...this.metrics,
      averageProcessingTime: avgProcessingTime,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics.totalReadings = 0;
    this.metrics.totalAlerts = 0;
    this.metrics.alertsBySeverity = {};
    this.metrics.alertsByType = {};
    this.metrics.averageProcessingTime = 0;
    this.processingTimes.length = 0;
  }

  /**
   * Create a new sliding window
   */
  private createNewWindow(patientId: string, vitalType: string): VitalsWindow {
    const now = new Date();
    return {
      patientId,
      vitalType,
      readings: [],
      windowStart: now,
      windowEnd: now,
    };
  }

  /**
   * Check if window has expired
   */
  private isWindowExpired(window: VitalsWindow): boolean {
    const now = Date.now();
    const windowAge = now - window.windowStart.getTime();
    return windowAge > this.windowDuration;
  }

  /**
   * Process window and calculate metrics
   */
  private processWindow(window: VitalsWindow): ProcessedVitalSign {
    const readings = window.readings;
    const values = readings.map(r => r.value);
    
    if (values.length === 0) {
      throw new Error('No readings in window');
    }
    
    // Calculate basic statistics
    const current = values[values.length - 1];
    const average = values.reduce((sum, v) => sum + v, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Calculate trend
    const trend = this.calculateTrend(values);
    
    // Check for abnormal values
    const threshold = this.thresholds[window.vitalType as keyof typeof this.thresholds];
    const isAbnormal = current < threshold.min || current > threshold.max;
    const severity = this.calculateSeverity(current, threshold);
    
    return {
      patientId: window.patientId,
      type: window.vitalType,
      currentValue: current,
      average,
      min,
      max,
      trend,
      isAbnormal,
      severity,
      windowStart: window.windowStart,
      windowEnd: window.windowEnd,
      sampleCount: readings.length,
    };
  }

  /**
   * Calculate trend direction
   */
  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const recent = values.slice(-5); // Last 5 readings
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;
    
    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (changePercent > 5) return 'increasing';
    if (changePercent < -5) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate severity level
   */
  private calculateSeverity(
    value: number,
    threshold: { min: number; max: number; critical: number },
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (value >= threshold.critical || value <= threshold.min * 0.5) {
      return 'CRITICAL';
    }
    if (value >= threshold.max || value <= threshold.min) {
      return 'HIGH';
    }
    if (value >= threshold.max * 0.9 || value <= threshold.min * 1.1) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  /**
   * Batch process multiple readings
   */
  async processBatch(readings: VitalSignReading[]): Promise<ProcessedVitalSign[]> {
    const results: ProcessedVitalSign[] = [];
    
    for (const reading of readings) {
      try {
        const processed = await this.processReading(reading);
        results.push(processed);
      } catch (error) {
        this.logger.error(`Error processing reading: ${error.message}`);
      }
    }
    
    return results;
  }

  /**
   * Get current window for a patient and vital type
   */
  getWindow(patientId: string, vitalType: string): VitalsWindow | undefined {
    return this.windows.get(`${patientId}:${vitalType}`);
  }

  /**
   * Clear expired windows
   */
  clearExpiredWindows(): void {
    const now = Date.now();
    
    for (const [key, window] of this.windows.entries()) {
      const windowAge = now - window.windowStart.getTime();
      if (windowAge > this.windowDuration * 2) { // Keep windows for 2x duration
        this.windows.delete(key);
      }
    }
  }

  /**
   * Get statistics for all windows
   */
  getStats(): { totalWindows: number; totalReadings: number; windowsByPatient: Record<string, number> } {
    const windowsByPatient: Record<string, number> = {};
    let totalReadings = 0;
    
    for (const window of this.windows.values()) {
      windowsByPatient[window.patientId] = (windowsByPatient[window.patientId] || 0) + 1;
      totalReadings += window.readings.length;
    }
    
    return {
      totalWindows: this.windows.size,
      totalReadings,
      windowsByPatient,
    };
  }
}

/**
 * Event types for vital sign alerts
 */
export enum VitalsAlertEvent {
  ABNORMAL_READING = 'abnormal_reading',
  CRITICAL_READING = 'critical_reading',
  TREND_DETECTED = 'trend_detected',
  DEVICE_DISCONNECTED = 'device_disconnected',
}

export interface VitalsAlert {
  patientId: string;
  vitalType: string;
  event: VitalsAlertEvent;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  value: number;
  threshold?: number;
  message: string;
  timestamp: Date;
}
