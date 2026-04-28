/**
 * Break-the-Glass Emergency Access System
 *
 * Provides HIPAA/JCI-compliant emergency override access to patient records
 * when a clinician does not normally have permission. All actions are heavily
 * audited, time-limited, and require mandatory post-hoc supervisor review.
 *
 * Usage:
 * ```ts
 * import { requestBreakTheGlass, hasActiveBreakTheGlass } from '@/lib/audit/breakTheGlass';
 *
 * // Request emergency access (from API route)
 * const grant = await requestBreakTheGlass({
 *   tenantId, userId: user.id, userName: user.displayName,
 *   userRole: user.role, patientId, reason: 'Cardiac arrest — need med history',
 *   reasonCategory: 'LIFE_THREATENING', durationMinutes: 30,
 * });
 *
 * // Check if user has active override for a patient
 * const allowed = await hasActiveBreakTheGlass({ tenantId, userId, patientId });
 * ```
 */

import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReasonCategory = 'LIFE_THREATENING' | 'URGENT_CARE' | 'CONTINUITY_OF_CARE';
export type BTGStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'REVIEWED';

export interface BreakTheGlassRequestArgs {
  tenantId: string;
  userId: string;
  userName?: string;
  userRole?: string;
  patientId: string;
  reason: string;
  reasonCategory?: ReasonCategory;
  durationMinutes?: number; // default 60
  ip?: string;
}

export interface BreakTheGlassGrant {
  id: string;
  expiresAt: Date;
}

export interface BreakTheGlassRecord {
  id: string;
  tenantId: string;
  requesterId: string;
  requesterName: string | null;
  requesterRole: string | null;
  patientId: string;
  reason: string;
  reasonCategory: string | null;
  status: string;
  grantedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedBy: string | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  accessCount: number;
  ipAddress: string | null;
}

// ---------------------------------------------------------------------------
// Default duration (minutes)
// ---------------------------------------------------------------------------

const DEFAULT_DURATION_MINUTES = 60;
const MAX_DURATION_MINUTES = 480; // 8 hours hard cap

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Request emergency break-the-glass access to a patient record.
 * Creates a time-limited access grant and logs the event.
 */
export async function requestBreakTheGlass(
  args: BreakTheGlassRequestArgs
): Promise<BreakTheGlassGrant> {
  const {
    tenantId,
    userId,
    userName,
    userRole,
    patientId,
    reason,
    reasonCategory,
    ip,
  } = args;

  // Clamp duration
  const rawDuration = args.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const durationMinutes = Math.max(1, Math.min(rawDuration, MAX_DURATION_MINUTES));

  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

  // First, expire any stale requests for this tenant (non-blocking best-effort)
  expireStaleRequests(tenantId).catch(() => {});

  const record = await prisma.breakTheGlassRequest.create({
    data: {
      tenantId,
      requesterId: userId,
      requesterName: userName || null,
      requesterRole: userRole || null,
      patientId,
      reason,
      reasonCategory: reasonCategory || null,
      status: 'ACTIVE',
      grantedAt: now,
      expiresAt,
      accessCount: 0,
      ipAddress: ip || null,
    },
  });

  // Audit log (non-blocking)
  createAuditLog(
    'break_the_glass',
    record.id,
    'EMERGENCY_ACCESS_GRANTED',
    userId,
    undefined,
    {
      patientId,
      reason,
      reasonCategory,
      durationMinutes,
      expiresAt: expiresAt.toISOString(),
      ipAddress: ip,
      requesterName: userName,
      requesterRole: userRole,
    },
    tenantId
  ).catch((err) => {
    logger.error('Failed to write BTG audit log', { category: 'auth', error: err });
  });

  logger.warn('Break-the-glass emergency access granted', {
    category: 'auth',
    tenantId,
    userId,
    patientId,
    reason,
    reasonCategory,
    durationMinutes,
    btgRequestId: record.id,
  });

  return { id: record.id, expiresAt };
}

/**
 * Check if a user has an active (non-expired, non-revoked) break-the-glass
 * grant for a specific patient.
 */
export async function hasActiveBreakTheGlass(args: {
  tenantId: string;
  userId: string;
  patientId: string;
}): Promise<boolean> {
  const { tenantId, userId, patientId } = args;
  const now = new Date();

  const active = await prisma.breakTheGlassRequest.findFirst({
    where: {
      tenantId,
      requesterId: userId,
      patientId,
      status: 'ACTIVE',
      expiresAt: { gt: now },
    },
    select: { id: true },
  });

  return !!active;
}

/**
 * Record that the emergency access was used (increment access counter).
 * Call this each time the user actually reads/modifies patient data
 * under the break-the-glass grant.
 */
export async function recordBreakTheGlassAccess(requestId: string): Promise<void> {
  try {
    await prisma.breakTheGlassRequest.update({
      where: { id: requestId },
      data: { accessCount: { increment: 1 } },
    });
  } catch (err) {
    logger.error('Failed to increment BTG access count', {
      category: 'auth',
      error: err,
      btgRequestId: requestId,
    });
  }
}

/**
 * Revoke an active break-the-glass grant (e.g., by a supervisor or admin).
 * The grant becomes immediately invalid.
 */
export async function revokeBreakTheGlass(args: {
  requestId: string;
  revokedBy: string;
  tenantId?: string;
}): Promise<void> {
  const { requestId, revokedBy } = args;
  const now = new Date();

  const record = await prisma.breakTheGlassRequest.findUnique({
    where: { id: requestId },
    select: { id: true, tenantId: true, requesterId: true, patientId: true, status: true },
  });

  if (!record) {
    throw new Error('Break-the-glass request not found');
  }

  if (record.status !== 'ACTIVE') {
    throw new Error(`Cannot revoke: request is already ${record.status}`);
  }

  await prisma.breakTheGlassRequest.update({
    where: { id: requestId },
    data: {
      status: 'REVOKED',
      revokedAt: now,
      revokedBy,
    },
  });

  // Audit log (non-blocking)
  createAuditLog(
    'break_the_glass',
    requestId,
    'EMERGENCY_ACCESS_REVOKED',
    revokedBy,
    undefined,
    {
      patientId: record.patientId,
      requesterId: record.requesterId,
      revokedAt: now.toISOString(),
    },
    record.tenantId
  ).catch((err) => {
    logger.error('Failed to write BTG revoke audit log', { category: 'auth', error: err });
  });

  logger.warn('Break-the-glass access revoked', {
    category: 'auth',
    tenantId: record.tenantId,
    btgRequestId: requestId,
    revokedBy,
    requesterId: record.requesterId,
    patientId: record.patientId,
  });
}

/**
 * Review/acknowledge a break-the-glass request (by a supervisor).
 * This marks the request as reviewed and records supervisor notes.
 * Required for compliance — all BTG events must be reviewed.
 */
export async function reviewBreakTheGlass(args: {
  requestId: string;
  reviewedBy: string;
  reviewNotes?: string;
  tenantId?: string;
}): Promise<void> {
  const { requestId, reviewedBy, reviewNotes } = args;
  const now = new Date();

  const record = await prisma.breakTheGlassRequest.findUnique({
    where: { id: requestId },
    select: { id: true, tenantId: true, requesterId: true, patientId: true, status: true, reason: true },
  });

  if (!record) {
    throw new Error('Break-the-glass request not found');
  }

  // Can review any status except already reviewed
  if (record.status === 'REVIEWED') {
    throw new Error('Request has already been reviewed');
  }

  await prisma.breakTheGlassRequest.update({
    where: { id: requestId },
    data: {
      status: 'REVIEWED',
      reviewedAt: now,
      reviewedBy,
      reviewNotes: reviewNotes || null,
    },
  });

  // Audit log (non-blocking)
  createAuditLog(
    'break_the_glass',
    requestId,
    'EMERGENCY_ACCESS_REVIEWED',
    reviewedBy,
    undefined,
    {
      patientId: record.patientId,
      requesterId: record.requesterId,
      originalReason: record.reason,
      reviewNotes,
      reviewedAt: now.toISOString(),
    },
    record.tenantId
  ).catch((err) => {
    logger.error('Failed to write BTG review audit log', { category: 'auth', error: err });
  });

  logger.info('Break-the-glass access reviewed', {
    category: 'auth',
    tenantId: record.tenantId,
    btgRequestId: requestId,
    reviewedBy,
    requesterId: record.requesterId,
    patientId: record.patientId,
  });
}

/**
 * Get all break-the-glass requests that need supervisor review.
 * Returns requests with status ACTIVE, EXPIRED, or REVOKED (but not yet REVIEWED).
 */
export async function getPendingReviews(tenantId: string): Promise<BreakTheGlassRecord[]> {
  const items = await prisma.breakTheGlassRequest.findMany({
    where: {
      tenantId,
      status: { in: ['ACTIVE', 'EXPIRED', 'REVOKED'] },
    },
    orderBy: { grantedAt: 'desc' },
    take: 500,
  });

  return items as unknown as BreakTheGlassRecord[];
}

/**
 * Expire all active break-the-glass requests whose expiresAt has passed.
 * Can be called from a cron job or lazily on access checks.
 *
 * Returns the number of expired requests.
 */
export async function expireStaleRequests(tenantId: string): Promise<number> {
  const now = new Date();

  try {
    const result = await prisma.breakTheGlassRequest.updateMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        expiresAt: { lte: now },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    const count = result.count;

    if (count > 0) {
      logger.info(`Expired ${count} stale break-the-glass request(s)`, {
        category: 'auth',
        tenantId,
        expiredCount: count,
      });

      // Audit log for the expiration batch (non-blocking)
      createAuditLog(
        'break_the_glass',
        'batch',
        'EMERGENCY_ACCESS_BATCH_EXPIRED',
        'system',
        undefined,
        { expiredCount: count, tenantId },
        tenantId
      ).catch(() => {});
    }

    return count;
  } catch (err) {
    logger.error('Failed to expire stale BTG requests', {
      category: 'auth',
      error: err,
      tenantId,
    });
    return 0;
  }
}
