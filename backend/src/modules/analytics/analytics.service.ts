import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetricType } from '@prisma/client';
import { startOfDay, endOfDay, subDays, subMonths } from 'date-fns';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async calculateAppointmentMetrics(period: 'DAILY' | 'WEEKLY' | 'MONTHLY', doctorId?: string) {
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;

    if (period === 'DAILY') {
      startDate = startOfDay(now);
      previousStartDate = startOfDay(subDays(now, 1));
    } else if (period === 'WEEKLY') {
      startDate = subDays(now, 7);
      previousStartDate = subDays(now, 14);
    } else {
      startDate = subMonths(now, 1);
      previousStartDate = subMonths(now, 2);
    }

    const where: any = {
      scheduledAt: { gte: startDate, lte: now },
    };
    if (doctorId) where.doctorId = doctorId;

    const currentCount = await this.prisma.appointment.count({ where });
    
    const previousWhere = { ...where, scheduledAt: { gte: previousStartDate, lte: startDate } };
    const previousCount = await this.prisma.appointment.count({ where: previousWhere });

    const changePercent = previousCount > 0 
      ? ((currentCount - previousCount) / previousCount) * 100 
      : 0;

    return this.prisma.analyticsMetric.create({
      data: {
        type: MetricType.APPOINTMENT_VOLUME,
        value: currentCount,
        previousValue: previousCount,
        changePercent,
        period,
        periodStart: startDate,
        periodEnd: now,
        doctorId,
        breakdown: {
          byStatus: await this.getAppointmentsByStatus(where),
          bySpecialization: await this.getAppointmentsBySpecialization(where),
        },
      },
    });
  }

  async calculateRevenueMetrics(period: 'DAILY' | 'WEEKLY' | 'MONTHLY', doctorId?: string) {
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;

    if (period === 'DAILY') {
      startDate = startOfDay(now);
      previousStartDate = startOfDay(subDays(now, 1));
    } else if (period === 'WEEKLY') {
      startDate = subDays(now, 7);
      previousStartDate = subDays(now, 14);
    } else {
      startDate = subMonths(now, 1);
      previousStartDate = subMonths(now, 2);
    }

    const where: any = {
      paidAt: { gte: startDate, lte: now },
      status: 'COMPLETED',
    };
    if (doctorId) {
      where.appointment = { doctorId };
    }

    const currentPayments = await this.prisma.payment.findMany({ where });
    const currentRevenue = currentPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const previousWhere = { ...where, paidAt: { gte: previousStartDate, lte: startDate } };
    const previousPayments = await this.prisma.payment.findMany({ where: previousWhere });
    const previousRevenue = previousPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const changePercent = previousRevenue > 0 
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
      : 0;

    return this.prisma.analyticsMetric.create({
      data: {
        type: MetricType.REVENUE,
        value: currentRevenue,
        previousValue: previousRevenue,
        changePercent,
        period,
        periodStart: startDate,
        periodEnd: now,
        doctorId,
        breakdown: {
          byPaymentMethod: await this.getRevenueByPaymentMethod(where),
        },
      },
    });
  }

  async calculateNoShowMetrics(period: 'DAILY' | 'WEEKLY' | 'MONTHLY', doctorId?: string) {
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;

    if (period === 'DAILY') {
      startDate = startOfDay(now);
      previousStartDate = startOfDay(subDays(now, 1));
    } else if (period === 'WEEKLY') {
      startDate = subDays(now, 7);
      previousStartDate = subDays(now, 14);
    } else {
      startDate = subMonths(now, 1);
      previousStartDate = subMonths(now, 2);
    }

    const where: any = {
      scheduledAt: { gte: startDate, lte: now },
    };
    if (doctorId) where.doctorId = doctorId;

    const totalAppointments = await this.prisma.appointment.count({ where });
    const noShowAppointments = await this.prisma.appointment.count({
      where: { ...where, status: 'NO_SHOW' },
    });

    const currentRate = totalAppointments > 0 ? (noShowAppointments / totalAppointments) * 100 : 0;

    const previousWhere = { ...where, scheduledAt: { gte: previousStartDate, lte: startDate } };
    const previousTotal = await this.prisma.appointment.count({ where: previousWhere });
    const previousNoShow = await this.prisma.appointment.count({
      where: { ...previousWhere, status: 'NO_SHOW' },
    });
    const previousRate = previousTotal > 0 ? (previousNoShow / previousTotal) * 100 : 0;

    const changePercent = previousRate > 0 
      ? ((currentRate - previousRate) / previousRate) * 100 
      : 0;

    return this.prisma.analyticsMetric.create({
      data: {
        type: MetricType.NO_SHOW_RATE,
        value: currentRate,
        previousValue: previousRate,
        changePercent,
        period,
        periodStart: startDate,
        periodEnd: now,
        doctorId,
      },
    });
  }

  async calculateConsultationTimeMetrics(period: 'DAILY' | 'WEEKLY' | 'MONTHLY', doctorId?: string) {
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;

    if (period === 'DAILY') {
      startDate = startOfDay(now);
      previousStartDate = startOfDay(subDays(now, 1));
    } else if (period === 'WEEKLY') {
      startDate = subDays(now, 7);
      previousStartDate = subDays(now, 14);
    } else {
      startDate = subMonths(now, 1);
      previousStartDate = subMonths(now, 2);
    }

    const where: any = {
      videoCallEndedAt: { gte: startDate, lte: now },
    };
    if (doctorId) {
      where.appointment = { doctorId };
    }

    const videoCalls = await this.prisma.videoCall.findMany({
      where,
      include: { appointment: true },
    });

    const currentAvgTime = videoCalls.length > 0
      ? videoCalls.reduce((sum, vc) => sum + (vc.duration || 0), 0) / videoCalls.length
      : 0;

    const previousWhere = { ...where, videoCallEndedAt: { gte: previousStartDate, lte: startDate } };
    const previousCalls = await this.prisma.videoCall.findMany({ where: previousWhere });
    const previousAvgTime = previousCalls.length > 0
      ? previousCalls.reduce((sum, vc) => sum + (vc.duration || 0), 0) / previousCalls.length
      : 0;

    const changePercent = previousAvgTime > 0 
      ? ((currentAvgTime - previousAvgTime) / previousAvgTime) * 100 
      : 0;

    return this.prisma.analyticsMetric.create({
      data: {
        type: MetricType.AVERAGE_CONSULTATION_TIME,
        value: currentAvgTime,
        previousValue: previousAvgTime,
        changePercent,
        period,
        periodStart: startDate,
        periodEnd: now,
        doctorId,
      },
    });
  }

  async generateReport(type: string, generatedBy: string, doctorId?: string) {
    const metrics = await this.prisma.analyticsMetric.findMany({
      where: { doctorId, type: type as any },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return this.prisma.analyticsReport.create({
      data: {
        name: `${type} Report - ${new Date().toLocaleDateString()}`,
        type,
        generatedBy,
        data: {
          metrics,
          summary: this.calculateSummary(metrics),
        },
        charts: this.generateChartConfigurations(metrics),
      },
    });
  }

  async getMetrics(type?: MetricType, period?: string, doctorId?: string) {
    const where: any = {};
    if (type) where.type = type;
    if (period) where.period = period;
    if (doctorId) where.doctorId = doctorId;

    return this.prisma.analyticsMetric.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getReports(type?: string, generatedBy?: string) {
    const where: any = {};
    if (type) where.type = type;
    if (generatedBy) where.generatedBy = generatedBy;

    return this.prisma.analyticsReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  private async getAppointmentsByStatus(where: any) {
    const statuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    const result: any = {};
    
    for (const status of statuses) {
      result[status] = await this.prisma.appointment.count({
        where: { ...where, status: status as any },
      });
    }
    
    return result;
  }

  private async getAppointmentsBySpecialization(where: any) {
    const appointments = await this.prisma.appointment.findMany({
      where,
      include: { doctor: true },
    });

    const result: any = {};
    appointments.forEach((apt) => {
      const spec = apt.doctor.specialization;
      result[spec] = (result[spec] || 0) + 1;
    });

    return result;
  }

  private async getRevenueByPaymentMethod(where: any) {
    // This would be expanded when multiple payment methods are supported
    const payments = await this.prisma.payment.findMany({ where });
    return {
      stripe: payments.reduce((sum, p) => sum + Number(p.amount), 0),
    };
  }

  private calculateSummary(metrics: any[]) {
    if (metrics.length === 0) return {};

    const latest = metrics[0];
    return {
      currentValue: latest.value,
      changePercent: latest.changePercent,
      trend: latest.changePercent > 0 ? 'up' : latest.changePercent < 0 ? 'down' : 'stable',
    };
  }

  private generateChartConfigurations(metrics: any[]) {
    return {
      lineChart: {
        labels: metrics.map((m) => new Date(m.periodStart).toLocaleDateString()).reverse(),
        datasets: [
          {
            label: 'Value',
            data: metrics.map((m) => m.value).reverse(),
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1,
          },
        ],
      },
      barChart: {
        labels: metrics.map((m) => new Date(m.periodStart).toLocaleDateString()).reverse(),
        datasets: [
          {
            label: 'Value',
            data: metrics.map((m) => m.value).reverse(),
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
          },
        ],
      },
    };
  }
}
