/**
 * Imdad Audit Logger
 *
 * Writes structured audit log entries to the ImdadAuditLog table.
 * Also supports querying audit logs with filters and pagination.
 */

import { prisma } from '@/lib/db/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'REJECT'
  | 'RECEIVE'
  | 'CONFIGURE'
  | 'IMPORT'
  | 'EXPORT'
  | 'ARCHIVE';

interface AuditLogParams {
  tenantId: string;
  organizationId?: string;
  actorUserId: string;
  actorRole?: string;
  action: AuditAction | string;
  resourceType: string;
  resourceId?: string;
  boundedContext?: string;
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  request?: Request;
}

interface AuditQueryParams {
  tenantId: string;
  organizationId?: string;
  resourceType?: string;
  resourceId?: string;
  actorUserId?: string;
  action?: AuditAction | string;
  boundedContext?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

interface AuditQueryResult {
  entries: unknown[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

async function log(params: AuditLogParams): Promise<void> {
  try {
    const ipAddress = params.request
      ? params.request.headers.get('x-forwarded-for') ||
        params.request.headers.get('x-real-ip') ||
        'unknown'
      : undefined;

    await prisma.imdadAuditLog.create({
      data: {
        tenantId: params.tenantId,
        organizationId: params.organizationId || null,
        actorUserId: params.actorUserId,
        actorRole: params.actorRole || null,
        action: params.action as any,
        resourceType: params.resourceType,
        resourceId: params.resourceId || null,
        boundedContext: params.boundedContext || null,
        previousData: (params.previousData as any) || undefined,
        newData: (params.newData as any) || undefined,
        metadata: (params.metadata as any) || undefined,
        ipAddress: ipAddress || null,
      } as any,
    });
  } catch (err) {
    // Audit logging should never break the main flow
    console.error('[IMDAD_AUDIT] Failed to write audit log:', err);
  }
}

async function query(params: AuditQueryParams): Promise<AuditQueryResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;
  const skip = (page - 1) * pageSize;

  const where: any = { tenantId: params.tenantId };
  if (params.organizationId) where.organizationId = params.organizationId;
  if (params.resourceType) where.resourceType = params.resourceType;
  if (params.resourceId) where.resourceId = params.resourceId;
  if (params.actorUserId) where.actorUserId = params.actorUserId;
  if (params.action) where.action = params.action;
  if (params.boundedContext) where.boundedContext = params.boundedContext;
  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) where.createdAt.gte = params.startDate;
    if (params.endDate) where.createdAt.lte = params.endDate;
  }

  const [entries, total] = await Promise.all([
    prisma.imdadAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' } as any,
      skip,
      take: pageSize,
    }),
    prisma.imdadAuditLog.count({ where }),
  ]);

  return { entries, total, page, pageSize };
}

/** The imdadAudit singleton used throughout the codebase */
export const imdadAudit = { log, query };
