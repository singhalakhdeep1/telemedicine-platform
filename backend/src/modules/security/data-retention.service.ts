import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { addYears } from 'date-fns';

@Injectable()
export class DataRetentionService {
  constructor(private prisma: PrismaService) {}

  async archiveOldRecords() {
    const retentionYears = 7; // HIPAA minimum retention period
    const cutoffDate = addYears(new Date(), -retentionYears);

    // Archive old medical records
    const oldRecords = await this.prisma.medicalRecord.findMany({
      where: {
        recordedAt: {
          lt: cutoffDate,
        },
      },
    });

    for (const record of oldRecords) {
      await this.prisma.medicalRecord.update({
        where: { id: record.id },
        data: { archived: true },
      });
    }

    return { archivedCount: oldRecords.length };
  }

  async deleteExpiredRecords() {
    const retentionYears = 10; // Extended retention before deletion
    const cutoffDate = addYears(new Date(), -retentionYears);

    // Delete archived records older than retention period
    const result = await this.prisma.medicalRecord.deleteMany({
      where: {
        recordedAt: {
          lt: cutoffDate,
        },
        archived: true,
      },
    });

    return { deletedCount: result.count };
  }
}
