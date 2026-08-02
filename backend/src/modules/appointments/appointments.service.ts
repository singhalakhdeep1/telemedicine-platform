import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentStatus } from '@prisma/client';
import { startOfDay, endOfDay, isWithinInterval } from 'date-fns';

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

  async createAppointment(patientId: string, data: any) {
    // Check if doctor is available
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: data.doctorId },
      include: { availabilitySlots: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Check for conflicting appointments
    const conflictingAppointment = await this.prisma.appointment.findFirst({
      where: {
        doctorId: data.doctorId,
        scheduledAt: {
          gte: new Date(data.scheduledAt),
          lt: new Date(new Date(data.scheduledAt).getTime() + data.duration * 60000),
        },
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      },
    });

    if (conflictingAppointment) {
      throw new ForbiddenException('Doctor is not available at this time');
    }

    return this.prisma.appointment.create({
      data: {
        patientId,
        doctorId: data.doctorId,
        userId: data.userId,
        scheduledAt: new Date(data.scheduledAt),
        duration: data.duration,
        reason: data.reason,
        symptoms: data.symptoms,
        status: AppointmentStatus.PENDING,
      },
      include: {
        doctor: {
          include: { user: true },
        },
        patient: {
          include: { user: true },
        },
      },
    });
  }

  async getPatientAppointments(patientId: string) {
    return this.prisma.appointment.findMany({
      where: { patientId },
      include: {
        doctor: {
          include: { user: true },
        },
      },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async getDoctorAppointments(doctorId: string) {
    return this.prisma.appointment.findMany({
      where: { doctorId },
      include: {
        patient: {
          include: { user: true },
        },
      },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async getAppointmentById(appointmentId: string) {
    return this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: {
          include: { user: true },
        },
        patient: {
          include: { user: true },
        },
        payment: true,
      },
    });
  }

  async updateAppointmentStatus(appointmentId: string, status: AppointmentStatus) {
    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status },
      include: {
        doctor: { include: { user: true } },
        patient: { include: { user: true } },
      },
    });
  }

  async getDoctorAvailability(doctorId: string, date: Date) {
    const slots = await this.prisma.availabilitySlot.findMany({
      where: { doctorId, isAvailable: true },
    });

    const appointments = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        scheduledAt: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
        status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS] },
      },
    });

    return {
      slots,
      bookedAppointments: appointments,
    };
  }

  async setDoctorAvailability(doctorId: string, slots: any[]) {
    // Delete existing slots
    await this.prisma.availabilitySlot.deleteMany({
      where: { doctorId },
    });

    // Create new slots
    return this.prisma.availabilitySlot.createMany({
      data: slots.map((slot) => ({
        doctorId,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isAvailable: true,
      })),
    });
  }
}
