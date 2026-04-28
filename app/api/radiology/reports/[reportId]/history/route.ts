import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/radiology/reports/[reportId]/history
 *
 * Returns all amendments for a radiology report.
 * Each amendment includes: originalFindings, originalImpression,
 * amendedFindings, amendedImpression, reason, amendedBy, amendedAt.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (
    req: NextRequest,
    { tenantId, userId },
    params,
  ) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const reportId = resolvedParams?.reportId as string;

    if (!reportId) {
      return NextResponse.json(
        { error: 'MISSING_REPORT_ID', message: 'Report ID is required / معرف التقرير مطلوب' },
        { status: 400 }
      );
    }

    // Fetch the report to verify it exists and belongs to the tenant
    const report = await prisma.radiologyReport.findFirst({
      where: { tenantId, id: reportId },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'REPORT_NOT_FOUND', message: 'Report not found / التقرير غير موجود' },
        { status: 404 }
      );
    }

    // Amendments are stored in the linked ordersHub order meta
    let amendments: any[] = [];

    if (report.orderId) {
      const order = await prisma.ordersHub.findFirst({
        where: { tenantId, id: report.orderId },
      });

      if (order) {
        const meta = ((order.meta || {}) as Record<string, any>);
        amendments = meta.amendments || [];
      }
    }

    // Enrich with user display names
    const userIds = [...new Set(amendments.map((a: any) => a.amendedBy).filter(Boolean))];
    let usersMap: Record<string, any> = {};

    if (userIds.length > 0) {
      try {
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, displayName: true, email: true },
        });
        usersMap = users.reduce<Record<string, any>>((acc, u) => {
          acc[u.id] = u;
          return acc;
        }, {});
      } catch {
        // User lookup is non-critical; continue without enrichment
      }
    }

    const enrichedAmendments = amendments.map((a: any) => {
      const amendUser = usersMap[a.amendedBy] || {};
      return {
        id: a.id,
        version: a.version,
        originalFindings: a.originalFindings,
        originalImpression: a.originalImpression,
        amendedFindings: a.amendedFindings,
        amendedImpression: a.amendedImpression,
        reason: a.reason,
        amendedBy: a.amendedBy,
        amendedByName: amendUser.displayName || amendUser.email || a.amendedByName || null,
        amendedAt: a.amendedAt,
      };
    });

    // Sort by version ascending (oldest first)
    enrichedAmendments.sort((a: any, b: any) => (a.version || 0) - (b.version || 0));

    logger.info('Radiology report amendment history retrieved', {
      category: 'api',
      tenantId,
      userId,
      route: `/api/radiology/reports/${reportId}/history`,
      reportId,
      amendmentCount: enrichedAmendments.length,
    });

    return NextResponse.json({
      reportId,
      reportStatus: report.status,
      currentFindings: report.findings,
      currentImpression: report.impression,
      amendments: enrichedAmendments,
      totalAmendments: enrichedAmendments.length,
    });
  }),
  { tenantScoped: true, permissionKey: 'radiology.view' }
);
