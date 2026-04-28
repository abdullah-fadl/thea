/**
 * Audit Logging Infrastructure
 * Centralized audit logging for security events
 */

import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { AuditLog, AuditAction, AuditResourceType } from '@/lib/models/AuditLog';
import { logger } from '@/lib/monitoring/logger';

export interface AuditContext {
  actorUserId: string;
  actorRole: string;
  actorEmail?: string;
  tenantId: string;
  groupId?: string;
  hospitalId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(
  context: AuditContext,
  action: AuditAction,
  resourceType: AuditResourceType,
  options: {
    resourceId?: string;
    success?: boolean;
    errorMessage?: string;
    metadata?: Record<string, any>;
  } = {}
): Promise<void> {
  try {
    // Resolve tenant UUID from key if needed
    let tenantUuid = context.tenantId;
    if (context.tenantId) {
      const tenant = await prisma.tenant.findFirst({
        where: tenantWhere(context.tenantId),
        select: { id: true },
      });
      tenantUuid = tenant?.id || context.tenantId;
    }

    if (!tenantUuid) {
      logger.warn('Skipping audit log - no valid tenantId', { category: 'auth' });
      return;
    }

    await prisma.auditLog.create({
      data: {
        tenantId: tenantUuid,
        actorUserId: context.actorUserId,
        actorRole: context.actorRole,
        actorEmail: context.actorEmail,
        groupId: context.groupId,
        hospitalId: context.hospitalId,
        action: action as string,
        resourceType: resourceType as string,
        resourceId: options.resourceId,
        ip: context.ip,
        userAgent: context.userAgent,
        method: context.method,
        path: context.path,
        success: options.success !== false,
        errorMessage: options.errorMessage,
        metadata: options.metadata,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    // Audit logging should never break the application
    logger.error('Failed to write audit log', { category: 'auth', error });
    if (process.env.NODE_ENV === 'development') {
      logger.error('Audit log data', { category: 'auth', context: JSON.stringify(context), action, resourceType, options: JSON.stringify(options) });
    }
  }
}

/**
 * Create audit context from authenticated user
 */
export function createAuditContext(
  user: {
    userId: string;
    userRole: string;
    userEmail?: string;
    tenantId: string;
    groupId?: string;
    hospitalId?: string;
  },
  request?: {
    ip?: string;
    userAgent?: string;
    method?: string;
    path?: string;
  }
): AuditContext {
  return {
    actorUserId: user.userId,
    actorRole: user.userRole,
    actorEmail: user.userEmail,
    tenantId: user.tenantId,
    groupId: user.groupId,
    hospitalId: user.hospitalId,
    ip: request?.ip,
    userAgent: request?.userAgent,
    method: request?.method,
    path: request?.path,
  };
}

/**
 * Ensure audit_logs collection has proper indexes
 * No-op with Prisma - indexes defined in schema
 */
export async function ensureAuditLogIndexes(): Promise<void> {
  // Indexes are defined in Prisma schema, no runtime setup needed
}
