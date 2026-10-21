/**
 * Base Repository Pattern Implementation with Soft Deletes and Audit
 * Provides common CRUD operations with transaction support
 * Implements Repository Pattern for data access abstraction
 * Enhanced with soft deletes, audit logging, and versioning
 */

import { PrismaClient } from '@prisma/client';
import { Injectable, Logger } from '@nestjs/common';

type WhereInput = Record<string, unknown>;
type IncludeInput = Record<string, unknown> | undefined;
type OrderByInput = Record<string, unknown> | Record<string, unknown>[];
type CreateInput = Record<string, unknown>;
type UpdateInput = Record<string, unknown>;

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
  userId?: string;
  changes?: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface VersionHistory {
  id: string;
  entityType: string;
  entityId: string;
  version: number;
  data: Record<string, any>;
  userId?: string;
  timestamp: Date;
  reason?: string;
}

@Injectable()
export abstract class BaseRepository<T> {
  protected readonly logger = new Logger(this.constructor.name);
  protected readonly prisma: PrismaClient;
  protected readonly enableSoftDeletes: boolean = true;
  protected readonly enableAuditLog: boolean = true;
  protected readonly enableVersioning: boolean = false;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Find single record by ID (excluding soft-deleted records)
   */
  async findById(id: string, include?: IncludeInput): Promise<T | null> {
    const where = this.enableSoftDeletes
      ? { id, deletedAt: null } as WhereInput
      : { id } as WhereInput;
    
    return this.prisma[this.getModelName()].findUnique({
      where,
      include,
    }) as Promise<T | null>;
  }

  /**
   * Find single record by conditions (excluding soft-deleted records)
   */
  async findOne(
    where: WhereInput,
    include?: IncludeInput,
  ): Promise<T | null> {
    const finalWhere = this.enableSoftDeletes
      ? { ...where, deletedAt: null } as WhereInput
      : where;
    
    return this.prisma[this.getModelName()].findFirst({
      where: finalWhere,
      include,
    }) as Promise<T | null>;
  }

  /**
   * Find multiple records with pagination (excluding soft-deleted records)
   */
  async findMany(
    where?: WhereInput,
    include?: IncludeInput,
    skip?: number,
    take?: number,
    orderBy?: OrderByInput,
  ): Promise<T[]> {
    const finalWhere = this.enableSoftDeletes && where
      ? { ...where, deletedAt: null } as WhereInput
      : where as WhereInput;
    
    return this.prisma[this.getModelName()].findMany({
      where: finalWhere,
      include,
      skip,
      take,
      orderBy,
    }) as Promise<T[]>;
  }

  /**
   * Cursor-based pagination for large datasets (excluding soft-deleted records)
   * Enhanced with bidirectional cursor support
   */
  async findManyCursor(
    where?: WhereInput,
    include?: IncludeInput,
    cursor?: string,
    take?: number,
    orderBy?: OrderByInput,
    direction?: 'forward' | 'backward',
  ): Promise<{ data: T[]; nextCursor: string | null; previousCursor: string | null; hasMore: boolean }> {
    const finalWhere = this.enableSoftDeletes && where
      ? { ...where, deletedAt: null } as WhereInput
      : where as WhereInput;
    
    const limit = take || 20;
    const cursorDirection = direction || 'forward';
    
    // For backward pagination, we need to reverse the order and take one extra record
    const actualTake = cursorDirection === 'backward' ? limit + 1 : limit;
    const actualOrderBy = cursorDirection === 'backward' 
      ? this.reverseOrderBy(orderBy || { id: 'asc' })
      : (orderBy || { id: 'asc' });
    
    const result = await this.prisma[this.getModelName()].findMany({
      where: finalWhere,
      include,
      cursor: cursor ? { id: cursor } : undefined,
      take: actualTake,
      orderBy: actualOrderBy,
    }) as T[];

    let data: T[];
    let nextCursor: string | null = null;
    let previousCursor: string | null = null;
    let hasMore = false;

    if (cursorDirection === 'backward') {
      // Reverse the results to get correct order
      data = result.slice(1).reverse();
      previousCursor = result.length > limit ? result[0]['id'] : null;
      hasMore = result.length > limit;
    } else {
      data = result;
      nextCursor = result.length === limit ? result[result.length - 1]['id'] : null;
      hasMore = result.length === limit;
    }

    return { data, nextCursor, previousCursor, hasMore };
  }

  /**
   * Reverse order by for backward pagination
   */
  private reverseOrderBy(orderBy: OrderByInput): OrderByInput {
    if (typeof orderBy === 'string') {
      return { [orderBy]: 'desc' };
    }
    
    if (Array.isArray(orderBy)) {
      return orderBy.map(item => {
        if (typeof item === 'string') {
          return { [item]: 'desc' };
        }
        const key = Object.keys(item)[0];
        return { [key]: item[key] === 'asc' ? 'desc' : 'asc' };
      });
    }
    
    const key = Object.keys(orderBy)[0];
    return { [key]: orderBy[key] === 'asc' ? 'desc' : 'asc' };
  }

  /**
   * Encode cursor with expiration and metadata
   */
  encodeCursor(cursor: string, expiresAt?: Date, metadata?: Record<string, any>): string {
    const payload = {
      cursor,
      expiresAt: expiresAt || new Date(Date.now() + 86400000), // 24 hours default
      metadata: metadata || {},
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  /**
   * Decode cursor and validate expiration
   */
  decodeCursor(encodedCursor: string): { cursor: string; valid: boolean; expired: boolean; metadata?: Record<string, any> } {
    try {
      const payload = JSON.parse(Buffer.from(encodedCursor, 'base64').toString());
      
      if (new Date(payload.expiresAt) < new Date()) {
        return { cursor: payload.cursor, valid: false, expired: true };
      }
      
      return { cursor: payload.cursor, valid: true, expired: false, metadata: payload.metadata };
    } catch (error) {
      return { cursor: '', valid: false, expired: false };
    }
  }

  /**
   * Find soft-deleted records
   */
  async findDeleted(
    where?: WhereInput,
    include?: IncludeInput,
  ): Promise<T[]> {
    const finalWhere = { ...where, deletedAt: { not: null } } as WhereInput;
    
    return this.prisma[this.getModelName()].findMany({
      where: finalWhere,
      include,
    }) as unknown as Promise<T[]>;
  }

  /**
   * Create new record with audit logging
   */
  async create(data: CreateInput, userId?: string): Promise<T> {
    const result = await this.prisma[this.getModelName()].create({
      data,
    }) as Promise<T>;

    if (this.enableAuditLog) {
      await this.logAudit('CREATE', result['id'], data, userId);
    }

    if (this.enableVersioning) {
      await this.saveVersion(result['id'], 1, data as Record<string, any>, userId);
    }

    return result;
  }

  /**
   * Update record by ID with audit logging and versioning
   */
  async update(
    id: string,
    data: UpdateInput,
    userId?: string,
  ): Promise<T> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Record with id ${id} not found`);
    }

    const result = await this.prisma[this.getModelName()].update({
      where: { id },
      data,
    }) as Promise<T>;

    if (this.enableAuditLog) {
      await this.logAudit('UPDATE', id, data, userId);
    }

    if (this.enableVersioning) {
      const currentVersion = await this.getCurrentVersion(id);
      await this.saveVersion(id, currentVersion + 1, result as Record<string, any>, userId);
    }

    return result;
  }

  /**
   * Soft delete record by ID
   */
  async softDelete(id: string, userId?: string): Promise<T> {
    const result = await this.prisma[this.getModelName()].update({
      where: { id },
      data: { deletedAt: new Date() } as UpdateInput,
    }) as Promise<T>;

    if (this.enableAuditLog) {
      await this.logAudit('DELETE', id, { deletedAt: new Date() }, userId);
    }

    return result;
  }

  /**
   * Restore soft-deleted record
   */
  async restore(id: string, userId?: string): Promise<T> {
    const result = await this.prisma[this.getModelName()].update({
      where: { id },
      data: { deletedAt: null } as UpdateInput,
    }) as Promise<T>;

    if (this.enableAuditLog) {
      await this.logAudit('RESTORE', id, { deletedAt: null }, userId);
    }

    return result;
  }

  /**
   * Hard delete record by ID
   */
  async delete(id: string, userId?: string): Promise<T> {
    if (this.enableAuditLog) {
      const existing = await this.prisma[this.getModelName()].findUnique({
        where: { id },
      }) as T;
      await this.logAudit('DELETE', id, existing, userId);
    }

    return this.prisma[this.getModelName()].delete({
      where: { id },
    }) as Promise<T>;
  }

  /**
   * Count records matching conditions (excluding soft-deleted records)
   */
  async count(where?: WhereInput): Promise<number> {
    const finalWhere = this.enableSoftDeletes && where
      ? { ...where, deletedAt: null } as WhereInput
      : where as WhereInput;
    
    return this.prisma[this.getModelName()].count({ where: finalWhere });
  }

  /**
   * Count soft-deleted records
   */
  async countDeleted(where?: WhereInput): Promise<number> {
    const finalWhere = { ...where, deletedAt: { not: null } } as WhereInput;
    return this.prisma[this.getModelName()].count({ where: finalWhere });
  }

  /**
   * Check if record exists (excluding soft-deleted records)
   */
  async exists(where: WhereInput): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }

  /**
   * Transaction support - Unit of Work Pattern
   */
  async transaction<R>(
    callback: (tx: PrismaClient) => Promise<R>,
  ): Promise<R> {
    return this.prisma.$transaction(callback);
  }

  /**
   * Batch operations
   */
  async createMany(data: CreateInput[], userId?: string): Promise<{ count: number }> {
    const result = await this.prisma[this.getModelName()].createMany({
      data,
      skipDuplicates: true,
    });

    if (this.enableAuditLog) {
      for (const item of data) {
        await this.logAudit('CREATE', item['id'] as string, item, userId);
      }
    }

    return result;
  }

  /**
   * Update many records
   */
  async updateMany(
    where: WhereInput,
    data: UpdateInput,
    userId?: string,
  ): Promise<{ count: number }> {
    const result = await this.prisma[this.getModelName()].updateMany({
      where,
      data,
    });

    if (this.enableAuditLog) {
      await this.logAudit('UPDATE', 'BATCH', { where, data }, userId);
    }

    return result;
  }

  /**
   * Log audit entry
   */
  private async logAudit(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE',
    entityId: string,
    changes: Record<string, any>,
    userId?: string,
  ): Promise<void> {
    try {
      const auditLog: AuditLog = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        entityType: this.getModelName(),
        entityId,
        action,
        userId,
        changes,
        timestamp: new Date(),
      };

      // In production, save to audit log table
      // For now, just log
      this.logger.log(`Audit: ${action} on ${this.getModelName()}:${entityId} by user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to log audit:', error);
    }
  }

  /**
   * Save version history
   */
  private async saveVersion(
    entityId: string,
    version: number,
    data: Record<string, any>,
    userId?: string,
  ): Promise<void> {
    try {
      const versionHistory: VersionHistory = {
        id: `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        entityType: this.getModelName(),
        entityId,
        version,
        data,
        userId,
        timestamp: new Date(),
      };

      // In production, save to version history table
      this.logger.log(`Version ${version} saved for ${this.getModelName()}:${entityId}`);
    } catch (error) {
      this.logger.error('Failed to save version:', error);
    }
  }

  /**
   * Get current version number
   */
  private async getCurrentVersion(entityId: string): Promise<number> {
    // In production, query version history table
    return 0;
  }

  /**
   * Get version history for an entity
   */
  async getVersionHistory(entityId: string): Promise<VersionHistory[]> {
    // In production, query version history table
    return [];
  }

  /**
   * Restore specific version
   */
  async restoreVersion(entityId: string, version: number, userId?: string): Promise<T> {
    const versionHistory = await this.getVersionHistory(entityId);
    const targetVersion = versionHistory.find(v => v.version === version);
    
    if (!targetVersion) {
      throw new Error(`Version ${version} not found for entity ${entityId}`);
    }

    return this.update(entityId, targetVersion.data as UpdateInput, userId);
  }

  /**
   * Get model name (to be implemented by child classes)
   */
  protected abstract getModelName(): string;
}
