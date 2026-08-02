import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { MedicalRecordsModule } from './modules/medical-records/medical-records.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { VideoConsultationModule } from './modules/video-consultation/video-consultation.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SecurityModule } from './modules/security/security.module';
import { IoTModule } from './modules/iot/iot.module';
import { EHRIntegrationModule } from './modules/ehr/ehr-integration.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { CommonModule } from './common/common.module';
import { StorageModule } from './modules/storage/storage.module';
import { EmailModule } from './modules/email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    AppointmentsModule,
    MedicalRecordsModule,
    PrescriptionsModule,
    VideoConsultationModule,
    NotificationsModule,
    PaymentsModule,
    SecurityModule,
    IoTModule,
    EHRIntegrationModule,
    AnalyticsModule,
    SchedulerModule,
    CommonModule,
    StorageModule,
    EmailModule,
  ],
})
export class AppModule {}
