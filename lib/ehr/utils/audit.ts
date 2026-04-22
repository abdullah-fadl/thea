/**
 * EHR Audit Utilities
 *
 * Helper functions for creating audit logs.
 */

import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/monitoring/logger';

export interface AuditLogInput {
  action: string;
  resourceType: string;
  resourceId?: string;
  userId: string;
  userName?: string;
  tenantId?: string; // CRITICAL: Always include tenantId for tenant isolation
  changes?: Array<{ field: string; oldValue?: any; newValue?: any }>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  patientId?: string;
  mrn?: string;
  success?: boolean; // Made optional to match usage
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    // Resolve tenant UUID from tenantId key if needed
    let tenantUuid = input.tenantId;
    if (input.tenantId && input.tenantId !== 'default') {
      const tenant = await prisma.tenant.findFirst({
        where: tenantWhere(input.tenantId),
        select: { id: true },
      });
      tenantUuid = tenant?.id || input.tenantId;
    }

    if (!tenantUuid || tenantUuid === 'default') {
      logger.warn('Skipping EHR audit log — no valid tenantId', { category: 'general' });
      return;
    }

    await prisma.auditLog.create({
      data: {
        tenantId: tenantUuid,
        actorUserId: input.userId,
        actorRole: 'unknown',
        actorEmail: input.userName,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        ip: input.ipAddress,
        userAgent: input.userAgent,
        success: input.success ?? true,
        errorMessage: input.errorMessage,
        metadata: {
          requestId: input.requestId,
          patientId: input.patientId,
          mrn: input.mrn,
          changes: input.changes,
          ...(input.metadata || {}),
        },
        timestamp: new Date(),
      },
    });
  } catch (error) {
    // Log error but don't throw - audit logging should not break main operations
    logger.error('Failed to create EHR audit log', { category: 'general', error });
  }
}

/**
 * Get ISO timestamp (deterministic)
 */
export function getISOTimestamp(): string {
  return new Date().toISOString();
}
