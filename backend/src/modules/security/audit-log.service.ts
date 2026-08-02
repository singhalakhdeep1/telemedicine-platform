import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async logAccess(userId: string, action: string, resource: string, resourceId: string) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        ipAddress: '127.0.0.1', // In production, get from request
        userAgent: 'Telemedicine Platform',
      },
    });
  }

  async getAuditLogs(filters?: { userId?: string; resource?: string; action?: string }) {
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
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }
}
