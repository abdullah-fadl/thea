import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { generateExpiryAlerts, checkCredentialStatus } from '@/lib/credentialing/engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/credentialing/alerts
 * List alerts, filterable by userId, alertType, read status
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = req.nextUrl;
    const userId = searchParams.get('userId');
    const alertType = searchParams.get('alertType');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const where: Record<string, any> = { tenantId, isDismissed: false };
    if (userId) where.userId = userId;
    if (alertType) where.alertType = alertType;
    if (unreadOnly) where.isRead = false;

    const items = await prisma.credentialAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ items });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'credentialing.view' },
);

/**
 * POST /api/credentialing/alerts
 * Generate expiry alerts (scan), or mark alerts as read/dismissed
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    let body: Record<string, any> = {};
    try {
      body = await req.json();
    } catch {
      // No body means generate scan
    }

    const action = body?.action || 'generate';

    // Generate alerts scan
    if (action === 'generate') {
      // First, update credential statuses
      const statusResult = await checkCredentialStatus(tenantId);
      // Then generate alerts
      const alertResult = await generateExpiryAlerts(tenantId);

      return NextResponse.json({
        success: true,
        statusScan: statusResult,
        alertsGenerated: alertResult.totalCreated,
        scannedAt: alertResult.scannedAt,
      });
    }

    // Mark alert as read
    if (action === 'mark_read' && body.alertId) {
      await prisma.credentialAlert.update({
        where: { id: body.alertId },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    // Mark all as read
    if (action === 'mark_all_read') {
      await prisma.credentialAlert.updateMany({
        where: { tenantId, isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    // Dismiss alert
    if (action === 'dismiss' && body.alertId) {
      await prisma.credentialAlert.update({
        where: { id: body.alertId },
        data: { isDismissed: true },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'credentialing.manage' },
);
