/**
 * Approved Access Audit Logging
 *
 * Logs all approved access activities for security and compliance
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export interface ApprovedAccessAuditLog {
  id: string; // UUID
  timestamp: Date;
  eventType:
    | 'request_created'
    | 'request_approved'
    | 'request_rejected'
    | 'access_activated'
    | 'access_revoked'
    | 'access_used'
    | 'access_expired';

  // Context
  requestId?: string; // ApprovedAccessToken.id
  ownerId: string;
  ownerEmail: string;
  tenantId: string;
  tenantName?: string;

  // Actor (who performed the action)
  actorId?: string; // User ID who performed action
  actorEmail?: string;
  actorRole?: string;

  // Details
  action: string; // Human-readable action description
  details?: Record<string, any>; // Additional context
  ipAddress?: string;
  userAgent?: string;

  // Result
  success: boolean;
  errorMessage?: string;
}

/**
 * Log an approved access event
 */
export async function logApprovedAccessEvent(
  event: Omit<ApprovedAccessAuditLog, 'id' | 'timestamp'>
): Promise<void> {
  try {
    await prisma.approvedAccessAuditLog.create({
      data: {
        eventType: event.eventType,
        requestId: event.requestId,
        ownerId: event.ownerId,
        ownerEmail: event.ownerEmail,
        tenantId: event.tenantId,
        tenantName: event.tenantName,
        actorId: event.actorId,
        actorEmail: event.actorEmail,
        actorRole: event.actorRole,
        action: event.action,
        details: event.details || undefined,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        success: event.success,
        errorMessage: event.errorMessage,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    // Don't fail the request if audit logging fails
    logger.error('Failed to log approved access event', { category: 'auth', error });
  }
}

/**
 * Get audit logs for a request
 */
export async function getAuditLogsForRequest(
  requestId: string
): Promise<ApprovedAccessAuditLog[]> {
  const rows = await prisma.approvedAccessAuditLog.findMany({
    where: { requestId },
    orderBy: { timestamp: 'desc' },
    take: 100,
  });
  return rows as unknown as ApprovedAccessAuditLog[];
}

/**
 * Get audit logs for an owner
 */
export async function getAuditLogsForOwner(
  ownerId: string,
  limit: number = 100
): Promise<ApprovedAccessAuditLog[]> {
  const rows = await prisma.approvedAccessAuditLog.findMany({
    where: { ownerId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
  return rows as unknown as ApprovedAccessAuditLog[];
}

/**
 * Get audit logs for a tenant
 */
export async function getAuditLogsForTenant(
  tenantId: string,
  limit: number = 100
): Promise<ApprovedAccessAuditLog[]> {
  const rows = await prisma.approvedAccessAuditLog.findMany({
    where: { tenantId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
  return rows as unknown as ApprovedAccessAuditLog[];
}
