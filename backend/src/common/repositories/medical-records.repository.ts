/**
 * Medical Records Repository
 * Implements Repository Pattern for medical records data access
 * Provides HIPAA-compliant data operations with audit logging
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient, MedicalRecord, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

@Injectable()
export class MedicalRecordsRepository extends BaseRepository<MedicalRecord> {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  protected getModelName(): string {
    return 'medicalRecord';
  }

  /**
   * Find medical records by patient with cursor-based pagination
   * Optimized for large datasets with composite indexes
   */
  async findByPatientCursor(
    patientId: string,
    cursor?: string,
    take: number = 20,
    recordType?: string,
  ) {
    const where: Prisma.MedicalRecordWhereInput = { patientId };
    if (recordType) {
      where.recordType = recordType as any;
    }

    return this.findManyCursor(
      where,
      { doctor: true },
      cursor,
      take,
      { recordedAt: 'desc' },
    );
  }

  /**
   * Find medical records by doctor with pagination
   */
  async findByDoctorCursor(
    doctorId: string,
    cursor?: string,
    take: number = 20,
  ) {
    return this.findManyCursor(
      { doctorId },
      { patient: true },
      cursor,
      take,
      { recordedAt: 'desc' },
    );
  }

  /**
   * Search medical records by FHIR resource content
   * Uses GIN index for efficient JSON search
   */
  async searchByFHIRContent(searchTerm: string) {
    return this.prisma.medicalRecord.findMany({
      where: {
        fhirResource: {
          path: [],
          string_contains: searchTerm,
        },
      },
      include: { patient: true, doctor: true },
      orderBy: { recordedAt: 'desc' },
    });
  }

  /**
   * Create medical record with audit logging
   * Part of HIPAA compliance
   */
  async createWithAudit(
    data: Prisma.MedicalRecordCreateInput,
    userId: string,
    ipAddress?: string,
  ) {
    const record = await this.create(data);

    // Audit log entry is logged locally until an external audit sink is configured.
    this.logger.log(
      `Medical record created: ${record.id} by user ${userId} from ${ipAddress}`,
    );

    return record;
  }

  /**
   * Batch create medical records with transaction
   */
  async createManyWithTransaction(
    records: Prisma.MedicalRecordCreateManyInput[],
  ) {
    return this.transaction(async (tx) => {
      return tx.medicalRecord.createMany({
        data: records,
        skipDuplicates: true,
      });
    });
  }
}
