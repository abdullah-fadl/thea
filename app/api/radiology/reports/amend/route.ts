import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const amendReportSchema = z.object({
  reportId: z.string().min(1, 'reportId is required'),
  amendedFindings: z.string().optional(),
  amendedImpression: z.string().optional(),
  reason: z.string().min(1, 'reason is required'),
}).refine(
  (data) => data.amendedFindings || data.amendedImpression,
  { message: 'At least one of amendedFindings or amendedImpression is required' }
);

/**
 * POST /api/radiology/reports/amend
 *
 * Amend a verified/signed radiology report.
 * Creates an amendment record preserving original findings/impression,
 * updates the report with new values, and marks status as AMENDED.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, amendReportSchema);
    if ('error' in v) return v.error;

    const { reportId, amendedFindings, amendedImpression, reason } = v.data;

    // Fetch the existing report
    const report = await prisma.radiologyReport.findFirst({
      where: { tenantId, id: reportId },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'REPORT_NOT_FOUND', message: 'Report not found / التقرير غير موجود' },
        { status: 404 }
      );
    }

    // Only verified/signed or completed reports can be amended
    const amendableStatuses = ['VERIFIED', 'COMPLETED', 'REPORTED'];
    if (!amendableStatuses.includes(report.status)) {
      return NextResponse.json(
        {
          error: 'INVALID_STATUS',
          message: `Report must be verified or completed to amend / يجب أن يكون التقرير مُتحققًا أو مكتملًا للتعديل`,
          currentStatus: report.status,
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const amendmentId = uuidv4();

    // Store the amendment record as JSON in a meta field on the report
    // since we don't have a dedicated amendments table yet.
    // We use a JSON array stored in the report's meta to track amendment history.
    const existingMeta = ((report as any).meta || {}) as Record<string, any>;
    const existingAmendments: any[] = existingMeta.amendments || [];

    const amendmentRecord = {
      id: amendmentId,
      originalFindings: report.findings || null,
      originalImpression: report.impression || null,
      amendedFindings: amendedFindings || null,
      amendedImpression: amendedImpression || null,
      reason,
      amendedBy: userId,
      amendedByName: user?.displayName || user?.email || null,
      amendedAt: now.toISOString(),
      version: existingAmendments.length + 1,
    };

    const updatedAmendments = [...existingAmendments, amendmentRecord];

    // Update the report with new findings/impression and mark as AMENDED
    const updateData: Record<string, unknown> = {
      status: 'AMENDED',
    };

    if (amendedFindings) {
      updateData.findings = amendedFindings;
    }
    if (amendedImpression) {
      updateData.impression = amendedImpression;
    }

    // We store amendment history in the ordersHub meta since RadiologyReport
    // does not have a JSON meta column — we update ordersHub linked order instead.
    await prisma.radiologyReport.update({
      where: { id: reportId },
      data: updateData as any,
    });

    // Store amendment history in the linked ordersHub order meta
    if (report.orderId) {
      const order = await prisma.ordersHub.findFirst({
        where: { tenantId, id: report.orderId },
      });
      if (order) {
        const orderMeta = ((order.meta || {}) as Record<string, any>);
        const orderAmendments: any[] = orderMeta.amendments || [];
        orderAmendments.push(amendmentRecord);
        await prisma.ordersHub.update({
          where: { id: report.orderId },
          data: {
            meta: { ...orderMeta, amendments: orderAmendments },
            status: 'AMENDED',
          },
        });
      }
    }

    // Audit trail
    await createAuditLog(
      'RadiologyReport',
      reportId,
      'REPORT_AMENDED',
      userId,
      user?.email || undefined,
      {
        amendmentId,
        reason,
        previousStatus: report.status,
        hadFindingsChange: !!amendedFindings,
        hadImpressionChange: !!amendedImpression,
      },
      tenantId,
      req
    );

    logger.info('Radiology report amended', {
      category: 'api',
      tenantId,
      userId,
      route: '/api/radiology/reports/amend',
      reportId,
      amendmentId,
      version: amendmentRecord.version,
    });

    return NextResponse.json({
      success: true,
      amendment: amendmentRecord,
      report: {
        id: reportId,
        status: 'AMENDED',
        findings: amendedFindings || report.findings,
        impression: amendedImpression || report.impression,
        amendmentCount: updatedAmendments.length,
      },
    });
  }),
  { tenantScoped: true, permissionKey: 'radiology.view' }
);
