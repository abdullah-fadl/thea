import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { getAuditLogs, logAudit } from '@/lib/cvision/access-control';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ═══════════════════════════════════════════════════════════════════ */
/* GET                                                                */
/* ═══════════════════════════════════════════════════════════════════ */

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const db = await getCVisionDb(tenantId);

      const action = searchParams.get('action') || 'list';
      const actionFilter = searchParams.get('auditAction') || undefined;
      const cvModule = searchParams.get('module') || undefined;
      const severity = searchParams.get('severity') || undefined;
      const userId = searchParams.get('userId') || undefined;
      const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

      if (action === 'list') {
        const items = await getAuditLogs(db, tenantId, { action: actionFilter, module: cvModule, severity, userId, limit });
        return NextResponse.json({ success: true, data: { items, total: items.length } });
      }

      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    } catch (err: any) {
      logger.error('[audit GET]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.audit.read' },
);

/* ═══════════════════════════════════════════════════════════════════ */
/* POST                                                               */
/* ═══════════════════════════════════════════════════════════════════ */

export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId }: any) => {
    try {
      const body = await request.json();
      const db = await getCVisionDb(tenantId);

      const result = await logAudit(db, tenantId, {
        userId: body.userId || userId,
        userName: body.userName || '',
        action: body.action,
        module: body.module,
        resourceType: body.resourceType || '',
        resourceId: body.resourceId || '',
        details: body.details || '',
        severity: body.severity,
        ipAddress: body.ipAddress,
      });
      return NextResponse.json({ success: true, ...result });
    } catch (err: any) {
      logger.error('[audit POST]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.audit.read' },
);
