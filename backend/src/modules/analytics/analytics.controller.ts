import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, MetricType } from '@prisma/client';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Post('metrics/appointments')
  async calculateAppointmentMetrics(
    @Body() data: { period: 'DAILY' | 'WEEKLY' | 'MONTHLY'; doctorId?: string },
  ) {
    return this.analyticsService.calculateAppointmentMetrics(data.period, data.doctorId);
  }

  @Post('metrics/revenue')
  async calculateRevenueMetrics(
    @Body() data: { period: 'DAILY' | 'WEEKLY' | 'MONTHLY'; doctorId?: string },
  ) {
    return this.analyticsService.calculateRevenueMetrics(data.period, data.doctorId);
  }

  @Post('metrics/no-show')
  async calculateNoShowMetrics(
    @Body() data: { period: 'DAILY' | 'WEEKLY' | 'MONTHLY'; doctorId?: string },
  ) {
    return this.analyticsService.calculateNoShowMetrics(data.period, data.doctorId);
  }

  @Post('metrics/consultation-time')
  async calculateConsultationTimeMetrics(
    @Body() data: { period: 'DAILY' | 'WEEKLY' | 'MONTHLY'; doctorId?: string },
  ) {
    return this.analyticsService.calculateConsultationTimeMetrics(data.period, data.doctorId);
  }

  @Get('metrics')
  async getMetrics(
    @Query('type') type?: MetricType,
    @Query('period') period?: string,
    @Query('doctorId') doctorId?: string,
  ) {
    return this.analyticsService.getMetrics(type, period, doctorId);
  }

  @Post('reports')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  async generateReport(
    @Request() req,
    @Body() data: { type: string; doctorId?: string },
  ) {
    return this.analyticsService.generateReport(
      data.type,
      req.user.id,
      data.doctorId || req.user.doctorId,
    );
  }

  @Get('reports')
  async getReports(
    @Query('type') type?: string,
    @Query('generatedBy') generatedBy?: string,
  ) {
    return this.analyticsService.getReports(type, generatedBy);
  }

  @Get('reports/:id')
  async getReport(@Param('id') id: string) {
    return this.analyticsService.getReports().then((reports) =>
      reports.find((r) => r.id === id),
    );
  }
}
