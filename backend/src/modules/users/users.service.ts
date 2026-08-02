import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, DoctorSpecialization, DoctorStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updatePatientProfile(userId: string, data: any) {
    const patient = await this.prisma.patient.update({
      where: { userId },
      data,
    });

    return patient;
  }

  async updateDoctorProfile(userId: string, data: any) {
    const doctor = await this.prisma.doctor.update({
      where: { userId },
      data,
    });

    return doctor;
  }

  async getDoctors(filters?: { specialization?: DoctorSpecialization; status?: DoctorStatus }) {
    return this.prisma.doctor.findMany({
      where: filters,
      include: {
        user: {
          select: {
            email: true,
            status: true,
          },
        },
      },
    });
  }

  async getDoctorById(doctorId: string) {
    return this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        user: true,
        availabilitySlots: true,
      },
    });
  }

  async verifyDoctor(doctorId: string, status: DoctorStatus) {
    return this.prisma.doctor.update({
      where: { id: doctorId },
      data: { status },
      include: {
        user: true,
      },
    });
  }

  async getAllUsers(role?: UserRole) {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      include: {
        patient: true,
        doctor: true,
      },
    });
  }

  async updateUserStatus(userId: string, status: any) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { status },
    });
  }
}
