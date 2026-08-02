import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { EncryptionService } from './encryption.service';
import { DataRetentionService } from './data-retention.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AuditLogService, EncryptionService, DataRetentionService],
  exports: [AuditLogService, EncryptionService, DataRetentionService],
})
export class SecurityModule {}
