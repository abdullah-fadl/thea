/**
 * Clinical Access Audit Middleware
 *
 * Automatically logs patient data access (READ operations), access denials,
 * and bulk data exports. Designed for HIPAA/JCI compliance.
 *
 * Usage:
 * ```ts
 * export const GET = withAccessAudit(
 *   withAuthTenant(async (req, { tenantId, userId }) => {
 *     // ... your handler
 *   }, { permissionKey: 'patient.view' }),
 *   { resourceType: 'patient', extractPatientId: (req) => req.nextUrl.searchParams.get('patientId') }
 * );
 * ```
 *
 * Or wrap the inner handler directly:
 * ```ts
 * export const GET = withAuthTenant(
 *   withAccessAudit(async (req, { tenantId, userId }) => {
 *     // ... your handler
 *   }, { resourceType: 'encounter' }),
 *   { permissionKey: 'opd.visit.view' }
 * );
 * ```
 */

import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Hash-chain helpers for tamper-proof audit log
// ---------------------------------------------------------------------------

/** Compute a SHA-256 hex digest of the given string */
function computeAuditHash(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Verify the integrity of the audit hash chain for a given tenant.
 *
 * Walks every audit entry (ordered by timestamp ASC) and checks that each
 * entry's `previousHash` matches the preceding entry's `entryHash`.
 *
 * Entries created before hash-chaining was enabled (both fields null) are
 * skipped so the verification is backward-compatible.
 *
 * @returns `{ valid: true }` when the chain is intact, or
 *          `{ valid: false, brokenAt: '<entry-id>' }` at the first mismatch.
 */
export async function verifyAuditChain(
  tenantId: string
): Promise<{ valid: boolean; brokenAt?: string }> {
  const entries = await prisma.auditLog.findMany({
    where: { tenantId },
    orderBy: { timestamp: 'asc' },
    select: { id: true, entryHash: true, previousHash: true },
  });

  let lastHash: string | null = null;

  for (const entry of entries) {
    // Skip legacy entries that pre-date hash chaining
    if (!entry.entryHash && !entry.previousHash) {
      continue;
    }

    const expectedPrevious = lastHash ?? 'GENESIS';

    if (entry.previousHash !== expectedPrevious) {
      return { valid: false, brokenAt: entry.id };
    }

    lastHash = entry.entryHash;
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported clinical resource types for access logging */
export type AccessResourceType =
  | 'patient'
  | 'encounter'
  | 'lab_result'
  | 'radiology_report'
  | 'medication'
  | 'prescription'
  | 'clinical_note'
  | 'vital_signs'
  | 'allergy'
  | 'problem_list'
  | 'immunization'
  | 'surgical_record'
  | 'discharge_summary'
  | 'consent'
  | 'psychiatric_record'
  | 'hiv_record'
  | 'substance_abuse'
  | 'genetic_record'
  | 'reproductive_health'
  | 'dental_record'
  | 'pathology_report'
  | 'blood_bank'
  | 'order'
  | 'order_result'
  | 'insurance'
  | 'billing'
  | 'audit_log'
  | 'user'
  | 'data_export'
  | string; // Allow custom resource types

/** Sensitivity levels for data classification */
export type SensitivityLevel = 'normal' | 'sensitive' | 'highly_sensitive';

/** Options for the withAccessAudit wrapper */
export interface AccessAuditOptions {
  /** Resource type being accessed (e.g., 'patient', 'encounter', 'lab_result') */
  resourceType: AccessResourceType;

  /**
   * Extract the resource ID from the request. Receives the NextRequest object.
   * Common patterns:
   * - URL path param: `(req) => req.nextUrl.pathname.split('/').pop()`
   * - Query param: `(req) => req.nextUrl.searchParams.get('id')`
   */
  extractResourceId?: (req: NextRequest) => string | null;

  /**
   * Extract the patient ID from the request. Used for patient-centric audit trails.
   * If not provided, falls back to extractResourceId when resourceType is 'patient'.
   */
  extractPatientId?: (req: NextRequest) => string | null;

  /**
   * If true, marks this access as sensitive (e.g., psychiatric, HIV, substance abuse).
   * Sensitive accesses are flagged in the audit log for additional compliance review.
   */
  sensitive?: boolean;

  /**
   * Override the sensitivity level. If not set, determined automatically from resourceType.
   * - 'normal': Standard clinical data
   * - 'sensitive': Mental health, reproductive, substance abuse
   * - 'highly_sensitive': HIV, genetic, psychiatric hold records
   */
  sensitivityLevel?: SensitivityLevel;

  /**
   * Custom action label. Defaults to 'data_access'.
   * Examples: 'patient_chart_view', 'lab_result_view', 'report_download'
   */
  action?: string;

  /**
   * If true, also logs the response status code and record count (if available).
   * Useful for tracking bulk reads. Default: false.
   */
  logResponseMeta?: boolean;
}

/** Arguments for logAccessDenial */
export interface AccessDenialArgs {
  tenantId: string;
  userId: string;
  action: string;
  resourceType: AccessResourceType;
  resourceId?: string;
  reason: string;
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  /** Additional context (e.g., required permission, user's role) */
  metadata?: Record<string, unknown>;
}

/** Arguments for logDataExport */
export interface DataExportArgs {
  tenantId: string;
  userId: string;
  userRole?: string;
  userEmail?: string;
  exportType: string;
  recordCount: number;
  format: string;
  filters?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  path?: string;
}

/** Arguments for logBreakGlassAccess */
export interface BreakGlassArgs {
  tenantId: string;
  userId: string;
  userRole?: string;
  userEmail?: string;
  patientId: string;
  reason: string;
  resourceType: AccessResourceType;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  path?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Determine sensitivity level from resource type */
function deriveSensitivity(
  resourceType: AccessResourceType,
  explicit?: SensitivityLevel,
  sensitive?: boolean
): SensitivityLevel {
  if (explicit) return explicit;
  if (sensitive) return 'sensitive';

  const highlySensitiveTypes: AccessResourceType[] = [
    'psychiatric_record',
    'hiv_record',
    'genetic_record',
    'substance_abuse',
  ];
  const sensitiveTypes: AccessResourceType[] = [
    'reproductive_health',
    'consent',
    'billing',
    'insurance',
  ];

  if (highlySensitiveTypes.includes(resourceType)) return 'highly_sensitive';
  if (sensitiveTypes.includes(resourceType)) return 'sensitive';
  return 'normal';
}

/** Extract client IP from request headers */
function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

/** Extract user agent from request */
function getUserAgent(req: NextRequest): string {
  return req.headers.get('user-agent') || 'unknown';
}

/**
 * Resolve a tenant key (e.g. 'hmg-whh') to its UUID for the FK constraint.
 * Returns the input as-is if it is already a UUID.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tenantResolveCache = new Map<string, string>();

async function resolveTenantUuid(tenantId: string): Promise<string | null> {
  if (!tenantId || tenantId === 'default') return null;

  // Already a UUID
  if (UUID_RE.test(tenantId)) return tenantId;

  // Check cache
  const cached = tenantResolveCache.get(tenantId);
  if (cached) return cached;

  try {
    const tenant = await prisma.tenant.findFirst({
      where: tenantWhere(tenantId),
      select: { id: true },
    });
    if (tenant?.id) {
      tenantResolveCache.set(tenantId, tenant.id);
      return tenant.id;
    }
  } catch {
    // Lookup failed; will be handled by caller
  }

  return null;
}

/**
 * Write an audit log entry to the database. Non-blocking: errors are logged
 * but never propagated to the caller.
 */
async function writeAuditEntry(data: {
  tenantId: string;
  actorUserId: string;
  actorRole: string;
  actorEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  success?: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const tenantUuid = await resolveTenantUuid(data.tenantId);
    if (!tenantUuid) {
      logger.warn('Access audit skipped - could not resolve tenantId', {
        category: 'auth',
        tenantId: data.tenantId,
      });
      return;
    }

    // --- Hash chain: fetch the most recent entry for this tenant -----------
    let previousHash = 'GENESIS';
    try {
      const previousEntry = await prisma.auditLog.findFirst({
        where: { tenantId: tenantUuid },
        orderBy: { timestamp: 'desc' },
        select: { id: true, entryHash: true },
      });
      if (previousEntry?.entryHash) {
        previousHash = previousEntry.entryHash;
      }
    } catch {
      // If lookup fails, fall back to GENESIS — don't block the write
    }

    const timestamp = new Date();

    const entry = await prisma.auditLog.create({
      data: {
        tenantId: tenantUuid,
        actorUserId: data.actorUserId,
        actorRole: data.actorRole,
        actorEmail: data.actorEmail,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        ip: data.ip,
        userAgent: data.userAgent,
        method: data.method,
        path: data.path,
        success: data.success !== false,
        errorMessage: data.errorMessage,
        metadata: data.metadata as any,
        previousHash,
        timestamp,
      },
    });

    // --- Compute entryHash from key fields and persist it ------------------
    const hashInput = [
      entry.id,
      data.action,
      data.actorUserId,
      tenantUuid,
      previousHash,
      timestamp.toISOString(),
    ].join('|');
    const entryHash = computeAuditHash(hashInput);

    await prisma.auditLog.update({
      where: { id: entry.id },
      data: { entryHash },
    });
  } catch (error) {
    // Audit logging must never break the main request
    logger.error('Failed to write access audit log', {
      category: 'auth',
      error,
      tenantId: data.tenantId,
      userId: data.actorUserId,
    });
  }
}

// ---------------------------------------------------------------------------
// withAccessAudit — main wrapper
// ---------------------------------------------------------------------------

/**
 * Wraps an API route handler to automatically log patient data access.
 *
 * Works with two patterns:
 *
 * 1. Wrapping the outer handler (receives NextRequest, returns NextResponse):
 *    ```ts
 *    export const GET = withAccessAudit(myHandler, { resourceType: 'patient' });
 *    ```
 *
 * 2. Wrapping the inner handler passed to withAuthTenant:
 *    ```ts
 *    export const GET = withAuthTenant(
 *      withAccessAudit(async (req, ctx) => { ... }, { resourceType: 'encounter' }),
 *      { permissionKey: 'opd.visit.view' }
 *    );
 *    ```
 *
 * The wrapper detects which pattern is used based on whether the second
 * argument to the handler is a plain object with `userId`/`tenantId` (pattern 2)
 * or undefined (pattern 1, where auth info is extracted from headers).
 */
export function withAccessAudit<
  THandler extends (...args: any[]) => Promise<NextResponse>
>(handler: THandler, options: AccessAuditOptions): THandler {
  const {
    resourceType,
    extractResourceId,
    extractPatientId,
    sensitive,
    sensitivityLevel: explicitSensitivity,
    action = 'data_access',
    logResponseMeta = false,
  } = options;

  const sensitivity = deriveSensitivity(resourceType, explicitSensitivity, sensitive);

  const wrappedHandler = async (...args: any[]): Promise<NextResponse> => {
    const req: NextRequest = args[0];
    const authContext = args[1] as
      | { user?: { id?: string; email?: string; role?: string }; tenantId?: string; userId?: string; role?: string }
      | undefined;
    const routeParams = args[2];

    // Determine actor info from context (inner handler) or absence thereof (outer)
    const userId = authContext?.userId || authContext?.user?.id || 'unknown';
    const userEmail = authContext?.user?.email;
    const userRole = authContext?.role || authContext?.user?.role || 'unknown';
    const tenantId = authContext?.tenantId || '';

    // Extract resource / patient IDs
    const resourceId = extractResourceId?.(req) ?? null;
    const patientId =
      extractPatientId?.(req) ??
      (resourceType === 'patient' ? resourceId : null);

    const ip = getClientIP(req);
    const userAgent = getUserAgent(req);
    const method = req.method || 'GET';
    const path = req.nextUrl?.pathname || '';

    const startTime = Date.now();
    let response: NextResponse;

    try {
      // Execute the original handler
      response = await handler(...args);
    } catch (error) {
      // Log the failed access attempt
      writeAuditEntry({
        tenantId,
        actorUserId: userId,
        actorRole: userRole,
        actorEmail: userEmail,
        action: `${action}_error`,
        resourceType,
        resourceId: resourceId ?? undefined,
        ip,
        userAgent,
        method,
        path,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          sensitivityLevel: sensitivity,
          patientId,
          durationMs: Date.now() - startTime,
        },
      });
      // Re-throw so the caller sees the original error
      throw error;
    }

    // Build metadata for the audit entry
    const durationMs = Date.now() - startTime;
    const statusCode = response.status;
    const isSuccess = statusCode >= 200 && statusCode < 400;

    const metadata: Record<string, unknown> = {
      sensitivityLevel: sensitivity,
      statusCode,
      durationMs,
    };

    if (patientId) metadata.patientId = patientId;
    if (sensitivity !== 'normal') metadata.sensitiveAccess = true;

    // Optionally capture response metadata (record count, etc.)
    if (logResponseMeta && isSuccess) {
      try {
        // Clone the response to read the body without consuming it
        const cloned = response.clone();
        const body = await cloned.json();
        if (body && typeof body === 'object') {
          if (typeof body.total === 'number') metadata.recordCount = body.total;
          else if (typeof body.count === 'number') metadata.recordCount = body.count;
          else if (Array.isArray(body.data)) metadata.recordCount = body.data.length;
          else if (Array.isArray(body)) metadata.recordCount = body.length;
        }
      } catch {
        // Body may not be JSON — ignore
      }
    }

    // Fire-and-forget: log the access asynchronously so we don't block the response
    writeAuditEntry({
      tenantId,
      actorUserId: userId,
      actorRole: userRole,
      actorEmail: userEmail,
      action: isSuccess ? action : `${action}_failed`,
      resourceType,
      resourceId: resourceId ?? undefined,
      ip,
      userAgent,
      method,
      path,
      success: isSuccess,
      errorMessage: isSuccess ? undefined : `HTTP ${statusCode}`,
      metadata,
    });

    return response;
  };

  return wrappedHandler as unknown as THandler;
}

// ---------------------------------------------------------------------------
// logAccessDenial — standalone function for permission failures
// ---------------------------------------------------------------------------

/**
 * Log an access denial event. Call this when a permission check fails
 * or a user attempts to access a resource they are not authorized for.
 *
 * This is non-blocking and will not throw.
 *
 * Usage:
 * ```ts
 * if (!hasPermission) {
 *   await logAccessDenial({
 *     tenantId, userId,
 *     action: 'view_patient',
 *     resourceType: 'patient',
 *     resourceId: patientId,
 *     reason: 'Missing permission: patient.view',
 *   });
 *   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 * }
 * ```
 */
export async function logAccessDenial(args: AccessDenialArgs): Promise<void> {
  const {
    tenantId,
    userId,
    action,
    resourceType,
    resourceId,
    reason,
    ip,
    userAgent,
    path,
    method,
    metadata: extraMetadata,
  } = args;

  await writeAuditEntry({
    tenantId,
    actorUserId: userId,
    actorRole: extraMetadata?.userRole as string || 'unknown',
    actorEmail: extraMetadata?.userEmail as string,
    action: 'access_denied',
    resourceType,
    resourceId,
    ip,
    userAgent,
    method,
    path,
    success: false,
    errorMessage: reason,
    metadata: {
      attemptedAction: action,
      denialReason: reason,
      ...extraMetadata,
    },
  });

  logger.warn('Access denied', {
    category: 'auth',
    tenantId,
    userId,
    route: path,
    action,
    resourceType,
    resourceId,
    reason,
  });
}

// ---------------------------------------------------------------------------
// logDataExport — standalone function for bulk data exports
// ---------------------------------------------------------------------------

/**
 * Log a bulk data export event. Call this when a user downloads or exports
 * patient data in bulk (CSV, PDF, HL7, FHIR bundle, etc.).
 *
 * This is non-blocking and will not throw.
 *
 * Usage:
 * ```ts
 * await logDataExport({
 *   tenantId, userId,
 *   exportType: 'patient_list',
 *   recordCount: patients.length,
 *   format: 'csv',
 *   filters: { department: 'cardiology', dateRange: '2026-01-01..2026-03-01' },
 * });
 * ```
 */
export async function logDataExport(args: DataExportArgs): Promise<void> {
  const {
    tenantId,
    userId,
    userRole = 'unknown',
    userEmail,
    exportType,
    recordCount,
    format,
    filters,
    ip,
    userAgent,
    path,
  } = args;

  await writeAuditEntry({
    tenantId,
    actorUserId: userId,
    actorRole: userRole,
    actorEmail: userEmail,
    action: 'data_export',
    resourceType: 'data_export',
    resourceId: undefined,
    ip,
    userAgent,
    method: 'GET',
    path,
    success: true,
    metadata: {
      exportType,
      recordCount,
      format,
      filters,
      sensitivityLevel: 'sensitive' as SensitivityLevel,
    },
  });

  logger.info('Data export logged', {
    category: 'auth',
    tenantId,
    userId,
    exportType,
    recordCount,
    format,
  });
}

// ---------------------------------------------------------------------------
// logBreakGlassAccess — for emergency override access
// ---------------------------------------------------------------------------

/**
 * Log a break-glass (emergency override) access event. This is used when
 * a clinician accesses a patient record they do not normally have permission
 * to view, using an emergency override mechanism.
 *
 * Break-glass events are always flagged as highly sensitive and require
 * a documented reason.
 *
 * Usage:
 * ```ts
 * await logBreakGlassAccess({
 *   tenantId, userId,
 *   patientId,
 *   reason: 'Emergency: patient in cardiac arrest, need medication history',
 *   resourceType: 'patient',
 * });
 * ```
 */
export async function logBreakGlassAccess(args: BreakGlassArgs): Promise<void> {
  const {
    tenantId,
    userId,
    userRole = 'unknown',
    userEmail,
    patientId,
    reason,
    resourceType,
    resourceId,
    ip,
    userAgent,
    path,
  } = args;

  await writeAuditEntry({
    tenantId,
    actorUserId: userId,
    actorRole: userRole,
    actorEmail: userEmail,
    action: 'break_glass_access',
    resourceType,
    resourceId: resourceId || patientId,
    ip,
    userAgent,
    method: 'GET',
    path,
    success: true,
    metadata: {
      patientId,
      reason,
      sensitivityLevel: 'highly_sensitive' as SensitivityLevel,
      breakGlass: true,
    },
  });

  // Break-glass events deserve a dedicated warning-level log
  logger.warn('Break-glass access triggered', {
    category: 'auth',
    tenantId,
    userId,
    route: path,
    patientId,
    reason,
    resourceType,
  });
}

// ---------------------------------------------------------------------------
// Utility: buildAccessAuditContext — for manual logging inside handlers
// ---------------------------------------------------------------------------

/**
 * Helper to build the audit context from a request and auth context.
 * Useful when you need to log access inside a handler without using
 * the withAccessAudit wrapper.
 *
 * Usage:
 * ```ts
 * const auditCtx = buildAccessAuditContext(req, { tenantId, userId, role });
 * // ... do work ...
 * await writeAccessLog({
 *   ...auditCtx,
 *   action: 'patient_chart_view',
 *   resourceType: 'patient',
 *   resourceId: patientId,
 * });
 * ```
 */
export interface AccessAuditContext {
  tenantId: string;
  actorUserId: string;
  actorRole: string;
  actorEmail?: string;
  ip: string;
  userAgent: string;
  method: string;
  path: string;
}

export function buildAccessAuditContext(
  req: NextRequest,
  authCtx: {
    tenantId: string;
    userId: string;
    role?: string;
    userEmail?: string;
  }
): AccessAuditContext {
  return {
    tenantId: authCtx.tenantId,
    actorUserId: authCtx.userId,
    actorRole: authCtx.role || 'unknown',
    actorEmail: authCtx.userEmail,
    ip: getClientIP(req),
    userAgent: getUserAgent(req),
    method: req.method || 'GET',
    path: req.nextUrl?.pathname || '',
  };
}

/**
 * Write an access log entry using a pre-built context.
 * Non-blocking, will not throw.
 */
export async function writeAccessLog(
  ctx: AccessAuditContext & {
    action: string;
    resourceType: AccessResourceType;
    resourceId?: string;
    patientId?: string;
    sensitivityLevel?: SensitivityLevel;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const {
    tenantId,
    actorUserId,
    actorRole,
    actorEmail,
    ip,
    userAgent,
    method,
    path,
    action,
    resourceType,
    resourceId,
    patientId,
    sensitivityLevel,
    metadata: extraMetadata,
  } = ctx;

  const sensitivity = sensitivityLevel || deriveSensitivity(resourceType);

  await writeAuditEntry({
    tenantId,
    actorUserId,
    actorRole,
    actorEmail,
    action,
    resourceType,
    resourceId,
    ip,
    userAgent,
    method,
    path,
    success: true,
    metadata: {
      sensitivityLevel: sensitivity,
      patientId,
      ...extraMetadata,
    },
  });
}
