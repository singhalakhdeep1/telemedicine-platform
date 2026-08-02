import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AnalyticsService } from '../analytics/analytics.service';
import { EHRIntegrationService } from '../ehr/ehr-integration.service';
import { DataRetentionService } from '../security/data-retention.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private analyticsService: AnalyticsService,
    private ehrService: EHRIntegrationService,
    private dataRetentionService: DataRetentionService,
    private prisma: PrismaService,
  ) {}

  // Calculate daily metrics at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async calculateDailyMetrics() {
    this.logger.log('Starting daily metrics calculation...');
    try {
      await this.analyticsService.calculateAppointmentMetrics('DAILY');
      await this.analyticsService.calculateRevenueMetrics('DAILY');
      await this.analyticsService.calculateNoShowMetrics('DAILY');
      await this.analyticsService.calculateConsultationTimeMetrics('DAILY');
      this.logger.log('Daily metrics calculation completed');
    } catch (error) {
      this.logger.error('Failed to calculate daily metrics', error);
    }
  }

  // Calculate weekly metrics every Sunday at midnight
  @Cron(CronExpression.EVERY_WEEK)
  async calculateWeeklyMetrics() {
    this.logger.log('Starting weekly metrics calculation...');
    try {
      await this.analyticsService.calculateAppointmentMetrics('WEEKLY');
      await this.analyticsService.calculateRevenueMetrics('WEEKLY');
      await this.analyticsService.calculateNoShowMetrics('WEEKLY');
      await this.analyticsService.calculateConsultationTimeMetrics('WEEKLY');
      this.logger.log('Weekly metrics calculation completed');
    } catch (error) {
      this.logger.error('Failed to calculate weekly metrics', error);
    }
  }

  // Calculate monthly metrics on the 1st of every month at midnight
  @Cron('0 0 1 * *')
  async calculateMonthlyMetrics() {
    this.logger.log('Starting monthly metrics calculation...');
    try {
      await this.analyticsService.calculateAppointmentMetrics('MONTHLY');
      await this.analyticsService.calculateRevenueMetrics('MONTHLY');
      await this.analyticsService.calculateNoShowMetrics('MONTHLY');
      await this.analyticsService.calculateConsultationTimeMetrics('MONTHLY');
      this.logger.log('Monthly metrics calculation completed');
    } catch (error) {
      this.logger.error('Failed to calculate monthly metrics', error);
    }
  }

  // Sync EHR connections daily at 2 AM
  @Cron('0 2 * * *')
  async syncEHRConnections() {
    this.logger.log('Starting EHR sync...');
    try {
      const connections = await this.prisma.eHRConnection.findMany({
        where: { status: 'ACTIVE' },
      });

      for (const connection of connections) {
        if (connection.syncFrequency === 'daily') {
          try {
            await this.ehrService.syncPatientData(connection.id);
            this.logger.log(`Synced EHR connection ${connection.id}`);
          } catch (error) {
            this.logger.error(`Failed to sync EHR connection ${connection.id}`, error);
          }
        }
      }
      this.logger.log('EHR sync completed');
    } catch (error) {
      this.logger.error('Failed to sync EHR connections', error);
    }
  }

  // Sync EHR connections weekly on Sunday at 3 AM
  @Cron('0 3 * * 0')
  async syncWeeklyEHRConnections() {
    this.logger.log('Starting weekly EHR sync...');
    try {
      const connections = await this.prisma.eHRConnection.findMany({
        where: { status: 'ACTIVE', syncFrequency: 'weekly' },
      });

      for (const connection of connections) {
        try {
          await this.ehrService.syncPatientData(connection.id);
          this.logger.log(`Synced EHR connection ${connection.id}`);
        } catch (error) {
          this.logger.error(`Failed to sync EHR connection ${connection.id}`, error);
        }
      }
      this.logger.log('Weekly EHR sync completed');
    } catch (error) {
      this.logger.error('Failed to sync weekly EHR connections', error);
    }
  }

  // Archive old records daily at 4 AM
  @Cron('0 4 * * *')
  async archiveOldRecords() {
    this.logger.log('Starting data archival...');
    try {
      await this.dataRetentionService.archiveOldRecords();
      this.logger.log('Data archival completed');
    } catch (error) {
      this.logger.error('Failed to archive old records', error);
    }
  }

  // Clean up old logs weekly on Sunday at 5 AM
  @Cron('0 5 * * 0')
  async cleanupOldLogs() {
    this.logger.log('Starting log cleanup...');
    try {
      // Delete logs older than 90 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      const result = await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          action: { in: ['LOGIN', 'LOGOUT'] }, // Only clean login/logout logs
        },
      });

      this.logger.log(`Cleaned up ${result.count} old log entries`);
    } catch (error) {
      this.logger.error('Failed to cleanup old logs', error);
    }
  }

  // Health check for IoT devices every hour
  @Cron(CronExpression.EVERY_HOUR)
  async checkIoTDeviceHealth() {
    this.logger.log('Checking IoT device health...');
    try {
      const devices = await this.prisma.iotDevice.findMany({
        where: { status: 'ACTIVE' },
      });

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      for (const device of devices) {
        if (device.lastSyncAt && device.lastSyncAt < oneHourAgo) {
          await this.prisma.iotDevice.update({
            where: { id: device.id },
            data: { status: 'DISCONNECTED' },
          });
          this.logger.warn(`Device ${device.id} marked as disconnected`);
        }
      }
      this.logger.log('IoT device health check completed');
    } catch (error) {
      this.logger.error('Failed to check IoT device health', error);
    }
  }
}
