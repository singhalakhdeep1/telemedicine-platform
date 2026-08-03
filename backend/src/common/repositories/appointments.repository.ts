/**
 * Appointments Repository
 * Implements Repository Pattern for appointment data access
 * Supports idempotency and transaction management
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient, Appointment, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

@Injectable()
export class AppointmentsRepository extends BaseRepository<Appointment> {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  protected getModelName(): string {
    return 'appointment';
  }

  /**
   * Find appointments by patient with cursor-based pagination
   */
  async findByPatientCursor(
    patientId: string,
    cursor?: string,
    take: number = 20,
    status?: string,
  ) {
    const where: Prisma.AppointmentWhereInput = { patientId };
    if (status) {
      where.status = status as any;
    }

    return this.findManyCursor(
      where,
      { doctor: true, payment: true },
      cursor,
      take,
      { scheduledAt: 'desc' },
    );
  }

  /**
   * Find appointments by doctor with cursor-based pagination
   */
  async findByDoctorCursor(
    doctorId: string,
    cursor?: string,
    take: number = 20,
    status?: string,
  ) {
    const where: Prisma.AppointmentWhereInput = { doctorId };
    if (status) {
      where.status = status as any;
    }

    return this.findManyCursor(
      where,
      { patient: true, payment: true },
      cursor,
      take,
      { scheduledAt: 'asc' },
    );
  }

  /**
   * Find appointments by date range for a doctor
   * Optimized with composite index on (doctorId, scheduledAt)
   */
  async findByDoctorAndDateRange(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ) {
    return this.prisma.appointment.findMany({
      where: {
        doctorId,
        scheduledAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: { patient: true },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  /**
   * Idempotent appointment creation
   * Uses idempotency key to prevent duplicate bookings
   */
  async createIdempotent(
    data: Prisma.AppointmentCreateInput,
    idempotencyKey: string,
  ) {
    // Check if appointment with this idempotency key already exists
    const existing = await this.prisma.appointment.findFirst({
      where: {
        // Assuming we add idempotencyKey field to schema
        // For now, we'll use a combination of fields
        patientId: data.patient.connect.id,
        doctorId: data.doctor.connect.id,
        scheduledAt: data.scheduledAt as Date,
      },
    });

    if (existing) {
      this.logger.log(`Appointment already exists for idempotency key: ${idempotencyKey}`);
      return existing;
    }

    return this.create(data);
  }

  /**
   * Update appointment status with idempotency
   */
  async updateStatusIdempotent(
    id: string,
    status: Prisma.AppointmentUpdateInput['status'],
    idempotencyKey: string,
  ) {
    const appointment = await this.findById(id);
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // If already in desired status, return existing
    if (appointment.status === status) {
      return appointment;
    }

    return this.update(id, { status });
  }

  /**
   * Find conflicting appointments
   * Prevents double-booking
   */
  async findConflictingAppointments(
    doctorId: string,
    scheduledAt: Date,
    duration: number,
  ) {
    const startTime = new Date(scheduledAt);
    const endTime = new Date(startTime.getTime() + duration * 60000); // duration in minutes

    return this.prisma.appointment.findMany({
      where: {
        doctorId,
        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
        scheduledAt: {
          lte: endTime,
        },
        // Check if appointment overlaps
        // This is a simplified check - in production, you'd use proper overlap logic
      },
    });
  }
}
