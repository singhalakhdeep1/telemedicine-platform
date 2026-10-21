import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { addYears } from 'date-fns';
import { Prisma } from '@prisma/client';

@Injectable()
export class DataRetentionService {
  constructor(private prisma: PrismaService) {}

  async archiveOldRecords() {
    const retentionYears = 7; // HIPAA minimum retention period
    const cutoffDate = addYears(new Date(), -retentionYears);

    const oldRecords = await this.prisma.medicalRecord.findMany({
      where: {
        recordedAt: { lt: cutoffDate },
        fhirResource: {
          path: ['archived'],
          not: Prisma.JsonNull,
        } as any,
      },
    });

    // Filter to only non-archived
    const toArchive = oldRecords.filter(r => {
      const res = r.fhirResource as Record<string, unknown>;
      return !res?.archived;
    });

    for (const record of toArchive) {
      const existing = record.fhirResource as Record<string, unknown>;
      await this.prisma.medicalRecord.update({
        where: { id: record.id },
        data: { fhirResource: { ...existing, archived: true } },
      });
    }

    return { archivedCount: toArchive.length };
  }

  async deleteExpiredRecords() {
    const retentionYears = 10; // Extended retention before deletion
    const cutoffDate = addYears(new Date(), -retentionYears);

    const archivedRecords = await this.prisma.medicalRecord.findMany({
      where: { recordedAt: { lt: cutoffDate } },
      select: { id: true, fhirResource: true },
    });

    const toDelete = archivedRecords.filter(r => {
      const res = r.fhirResource as Record<string, unknown>;
      return res?.archived === true;
    });

    for (const r of toDelete) {
      await this.prisma.medicalRecord.delete({ where: { id: r.id } });
    }

    return { deletedCount: toDelete.length };
  }
}
