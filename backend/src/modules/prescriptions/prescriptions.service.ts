import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrescriptionStatus } from '@prisma/client';

@Injectable()
export class PrescriptionsService {
  constructor(private prisma: PrismaService) {}

  async createPrescription(doctorId: string, patientId: string, data: any) {
    const prescription = await this.prisma.prescription.create({
      data: {
        patientId,
        doctorId,
        appointmentId: data.appointmentId,
        status: PrescriptionStatus.ACTIVE,
        diagnosis: data.diagnosis,
        notes: data.notes,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        drugs: {
          create: data.drugs,
        },
      },
      include: {
        drugs: true,
        patient: { include: { user: true } },
        doctor: { include: { user: true } },
      },
    });

    return prescription;
  }

  async getPatientPrescriptions(patientId: string) {
    return this.prisma.prescription.findMany({
      where: { patientId },
      include: {
        drugs: true,
        doctor: { include: { user: true } },
      },
      orderBy: { prescribedAt: 'desc' },
    });
  }

  async getDoctorPrescriptions(doctorId: string) {
    return this.prisma.prescription.findMany({
      where: { doctorId },
      include: {
        drugs: true,
        patient: { include: { user: true } },
      },
      orderBy: { prescribedAt: 'desc' },
    });
  }

  async getPrescriptionById(prescriptionId: string) {
    return this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        drugs: true,
        patient: { include: { user: true } },
        doctor: { include: { user: true } },
      },
    });
  }

  async updatePrescriptionStatus(prescriptionId: string, status: PrescriptionStatus) {
    return this.prisma.prescription.update({
      where: { id: prescriptionId },
      data: { status },
      include: {
        drugs: true,
        patient: { include: { user: true } },
        doctor: { include: { user: true } },
      },
    });
  }

  async addDrugToPrescription(prescriptionId: string, drugData: any) {
    return this.prisma.prescriptionDrug.create({
      data: {
        prescriptionId,
        drugName: drugData.drugName,
        dosage: drugData.dosage,
        frequency: drugData.frequency,
        duration: drugData.duration,
        instructions: drugData.instructions,
      },
    });
  }
}
