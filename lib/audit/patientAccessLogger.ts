/**
 * Patient Record Access Logger
 *
 * Thin wrapper around the access audit system for quick fire-and-forget
 * patient record access logging. Use this in GET routes that return
 * patient data to create a compliance audit trail of "who viewed what".
 *
 * Usage:
 *   logPatientAccess({ tenantId, userId, userRole, patientId, accessType: 'view', resourceType: 'demographics' });
 *
 * For full middleware-based logging, use withAccessAudit from @/lib/audit/accessLogger.
 */

import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PatientAccessContext {
  tenantId: string;
  userId: string;
  userRole: string;
  userEmail?: string;
  patientId: string;
  accessType: 'view' | 'edit' | 'print' | 'export';
  resourceType: string; // 'demographics', 'clinical_notes', 'lab_results', 'medications', etc.
  ip?: string;
  userAgent?: string;
  path?: string;
}

// ---------------------------------------------------------------------------
// UUID detection
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Main function — fire and forget
// ---------------------------------------------------------------------------

/**
 * Log a patient record access event.
 * This function NEVER throws — errors are swallowed and logged.
 * It does NOT await the database write (fire-and-forget).
 *
 * Call this after successfully returning patient data to the caller.
 */
export function logPatientAccess(context: PatientAccessContext): void {
  // Fire-and-forget: don't await, don't throw
  _writePatientAccess(context).catch((err) => {
    logger.error('Failed to log patient access', {
      category: 'auth',
      error: err instanceof Error ? err.message : String(err),
      patientId: context.patientId,
    });
  });
}

async function _writePatientAccess(ctx: PatientAccessContext): Promise<void> {
  // Resolve tenantId to UUID if needed
  let tenantUuid = ctx.tenantId;
  if (ctx.tenantId && !UUID_RE.test(ctx.tenantId)) {
    const tenant = await prisma.tenant.findFirst({
      where: tenantWhere(ctx.tenantId),
      select: { id: true },
    });
    if (!tenant?.id) return; // Can't log without valid tenant
    tenantUuid = tenant.id;
  }

  await prisma.auditLog.create({
    data: {
      tenantId: tenantUuid,
      actorUserId: ctx.userId,
      actorRole: ctx.userRole,
      actorEmail: ctx.userEmail,
      action: 'patient_record_access',
      resourceType: 'patient',
      resourceId: ctx.patientId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      method: 'GET',
      path: ctx.path,
      success: true,
      metadata: {
        patientId: ctx.patientId,
        accessType: ctx.accessType,
        clinicalResourceType: ctx.resourceType,
      },
      timestamp: new Date(),
    },
  });
}
