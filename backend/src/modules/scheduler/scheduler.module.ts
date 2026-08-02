import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EHRIntegrationModule } from '../ehr/ehr-integration.module';
import { SecurityModule } from '../security/security.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AnalyticsModule,
    EHRIntegrationModule,
    SecurityModule,
    PrismaModule,
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
