import { Module } from '@nestjs/common';
import { VideoConsultationService } from './video-consultation.service';
import { VideoConsultationController } from './video-consultation.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [VideoConsultationController],
  providers: [VideoConsultationService],
  exports: [VideoConsultationService],
})
export class VideoConsultationModule {}
