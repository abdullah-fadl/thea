import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

interface ErAuditLogInput {
  _db?: any;
  db?: any;
  tenantId: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  ip?: string | null;
  actorId?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  dispositionType?: string | null;
  dispositionReason?: string | null;
  requestId?: string | null;
}

/**
 * Write an ER audit-log entry using the shared AuditLog Prisma model.
 *
 * ER-specific fields (entityType, entityId, before/after, fromStatus,
 * toStatus, dispositionType, dispositionReason, requestId) are stored
 * in the `metadata` JSON column.
 */
export async function writeErAuditLog(input: ErAuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorId ?? input.userId,
        actorRole: 'er', // generic ER actor role tag
        ip: input.ip ?? null,
        action: input.action,
        resourceType: input.entityType,
        resourceId: input.entityId,
        metadata: {
          before: input.before ?? null,
          after: input.after ?? null,
          fromStatus: input.fromStatus ?? null,
          toStatus: input.toStatus ?? null,
          dispositionType: input.dispositionType ?? null,
          dispositionReason: input.dispositionReason ?? null,
          requestId: input.requestId ?? null,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to write ER audit log', { category: 'er', error });
  }
}
