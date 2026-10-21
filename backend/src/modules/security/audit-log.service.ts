import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async logAccess(userId: string, action: AuditAction, resource: string, resourceId?: string) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        ipAddress: '127.0.0.1',
        userAgent: 'Telemedicine Platform',
      },
    });
  }

  async getAuditLogs(filters?: { userId?: string; resource?: string; action?: AuditAction }) {
    return this.prisma.auditLog.findMany({
      where: filters,
      include: {
        user: {
          select: {
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
