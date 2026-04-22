import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { enforceAuditRetention, getRetentionStats } from '@/lib/audit/retention';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/admin/audit/retention
 *
 * View current retention stats: total records, oldest record, records eligible for deletion.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const retentionDays = parseInt(req.nextUrl.searchParams.get('retentionDays') || '2555', 10);
    const stats = await getRetentionStats(tenantId, retentionDays);

    return NextResponse.json(stats);
  }),
  { tenantScoped: true, permissionKey: 'admin.audit' },
);

const retentionBodySchema = z.object({
  retentionDays: z.number().int().min(365).max(10000).optional(),
  dryRun: z.boolean().optional(),
  batchSize: z.number().int().min(100).max(50000).optional(),
}).passthrough();

/**
 * POST /api/admin/audit/retention
 *
 * Trigger audit log retention cleanup.
 * Requires admin.audit permission.
 * Supports dry-run mode.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, retentionBodySchema);
    if ('error' in v) return v.error;

    const result = await enforceAuditRetention(tenantId, {
      retentionDays: v.data.retentionDays,
      dryRun: v.data.dryRun,
      batchSize: v.data.batchSize,
    });

    return NextResponse.json(result);
  }),
  { tenantScoped: true, permissionKey: 'admin.audit' },
);
