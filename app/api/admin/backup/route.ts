import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { exportTenantData } from '@/lib/backup/export';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/backup — Returns backup status and last export info
 */
export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }) => {
    return NextResponse.json({
      tenantId,
      backupType: 'on-demand',
      supabaseAutoBackup: 'Enabled via Supabase Dashboard (Pro plan: daily automatic + PITR)',
      note: 'POST to this endpoint to trigger a data export',
      timestamp: new Date().toISOString(),
    });
  }),
  { tenantScoped: true }
);

/**
 * POST /api/admin/backup — Triggers a data export for the tenant
 * Returns a gzip-compressed JSON file with critical data.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId, userId }) => {
    logger.info('Backup export started', { category: 'backup', tenantId, userId });

    const result = await exportTenantData(tenantId);

    logger.info('Backup export completed', {
      category: 'backup',
      tenantId,
      userId,
      counts: result.counts,
      sizeBytes: result.sizeBytes,
      compressedSizeBytes: result.compressedSizeBytes,
    });

    await createAuditLog(
      'backup',
      tenantId,
      'BACKUP_EXPORTED',
      userId || 'system',
      undefined,
      { counts: result.counts, sizeBytes: result.sizeBytes },
      tenantId
    );

    const filename = `thea-backup-${tenantId}-${result.exportedAt.slice(0, 10)}.json.gz`;

    return new NextResponse(new Uint8Array(result.data), {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(result.compressedSizeBytes),
        'X-Backup-Tenant': tenantId,
        'X-Backup-Date': result.exportedAt,
        'X-Backup-Records': JSON.stringify(result.counts),
      },
    });
  }),
  { tenantScoped: true, permissionKey: 'admin.backup' }
);
