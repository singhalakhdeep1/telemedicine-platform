import { Controller, Post, Put, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { VideoConsultationService } from './video-consultation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('video-consultation')
@UseGuards(JwtAuthGuard)
export class VideoConsultationController {
  constructor(private videoConsultationService: VideoConsultationService) {}

  @Post('appointment/:appointmentId')
  async createVideoCall(@Param('appointmentId') appointmentId: string) {
    return this.videoConsultationService.createVideoCall(appointmentId);
  }

  @Put(':id/start')
  async startVideoCall(@Param('id') id: string) {
    return this.videoConsultationService.startVideoCall(id);
  }

  @Put(':id/end')
  async endVideoCall(@Param('id') id: string, @Body() data: { duration: number }) {
    return this.videoConsultationService.endVideoCall(id, data.duration);
  }

  @Get('appointment/:appointmentId')
  async getVideoCallByAppointment(@Param('appointmentId') appointmentId: string) {
    return this.videoConsultationService.getVideoCallByAppointment(appointmentId);
  }
}
