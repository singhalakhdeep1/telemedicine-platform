import { Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class VideoConsultationService {
  constructor(private prisma: PrismaService) {}

  async createVideoCall(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const roomId = uuidv4();
    const patientToken = this.generateToken(roomId, 'patient');
    const doctorToken = this.generateToken(roomId, 'doctor');

    const videoCall = await this.prisma.videoCall.create({
      data: {
        appointmentId,
        roomId,
        patientToken,
        doctorToken,
      },
    });

    // Update appointment with video call ID
    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { videoCallId: videoCall.id },
    });

    return videoCall;
  }

  async startVideoCall(videoCallId: string) {
    return this.prisma.videoCall.update({
      where: { id: videoCallId },
      data: { startedAt: new Date() },
    });
  }

  async endVideoCall(videoCallId: string, duration: number) {
    const videoCall = await this.prisma.videoCall.update({
      where: { id: videoCallId },
      data: {
        endedAt: new Date(),
        duration,
      },
    });

    // Update appointment status
    await this.prisma.appointment.update({
      where: { id: videoCall.appointmentId },
      data: { status: AppointmentStatus.COMPLETED },
    });

    return videoCall;
  }

  async getVideoCallByAppointment(appointmentId: string) {
    return this.prisma.videoCall.findUnique({
      where: { appointmentId },
    });
  }

  private generateToken(roomId: string, role: string): string {
    // In production, use proper JWT or WebRTC token generation
    // This is a simplified version
    return Buffer.from(`${roomId}:${role}:${Date.now()}`).toString('base64');
  }
}
