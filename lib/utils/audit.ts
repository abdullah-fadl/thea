import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { logger } from '@/lib/monitoring/logger';

// [G-05] Extract client IP address from request headers
function getClientIP(req?: { headers?: { get?: (name: string) => string | null } }): string {
  if (!req?.headers?.get) return 'unknown';
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

export interface AuditLogEntry {
  id: string; // UUID
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  userEmail?: string;
  changes?: Record<string, any>; // Before/after changes
  timestamp: Date;
  tenantId: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(
  entityType: string,
  entityId: string,
  action: string,
  userId: string,
  userEmail?: string,
  changes?: Record<string, any>,
  tenantId?: string,
  req?: { headers?: { get?: (name: string) => string | null } } // [G-05] optional request for IP
): Promise<void> {
  try {
    // Resolve tenant UUID from key if needed
    let tenantUuid = tenantId;
    if (tenantId && tenantId !== 'default') {
      const tenant = await prisma.tenant.findFirst({
        where: tenantWhere(tenantId),
        select: { id: true },
      });
      tenantUuid = tenant?.id || tenantId;
    }

    if (!tenantUuid || tenantUuid === 'default') {
      // Can't create audit log without valid tenantId (FK constraint)
      logger.warn('Skipping audit log - no valid tenantId', { category: 'general' });
      return;
    }

    await prisma.auditLog.create({
      data: {
        tenantId: tenantUuid,
        actorUserId: userId,
        actorRole: 'unknown',
        actorEmail: userEmail,
        action,
        resourceType: entityType,
        resourceId: entityId,
        metadata: changes ? { ...changes, ipAddress: getClientIP(req) } : { ipAddress: getClientIP(req) },
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Failed to create audit log entry', { category: 'general', error });
    // Don't throw - audit logging should not break the main operation
  }
}
