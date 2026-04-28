import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { checkOrderPayment } from '@/lib/billing/paymentGate';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

const saveRadiologyReportBodySchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  findings: z.string().min(1, 'findings is required'),
  findingsAr: z.string().optional(),
  impression: z.string().min(1, 'impression is required'),
  impressionAr: z.string().optional(),
  templateId: z.string().optional(),
  status: z.string().optional(),
  sections: z.array(z.object({
    title: z.string(),
    content: z.string(),
  })).optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, saveRadiologyReportBodySchema);
    if ('error' in v) return v.error;
    const { orderId, findings, findingsAr, impression, impressionAr, templateId, status, sections } = v.data;

    const order = await prisma.ordersHub.findFirst({
      where: { tenantId, id: orderId, kind: 'RADIOLOGY' },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const paymentCheck = await checkOrderPayment(null, tenantId, orderId, 'RADIOLOGY');
    if (!paymentCheck.allowed) {
      return NextResponse.json(
        {
          error: 'PAYMENT_REQUIRED',
          message: paymentCheck.reason,
          paymentStatus: paymentCheck.paymentStatus,
        },
        { status: 402 }
      );
    }

    const now = new Date();
    const meta = (order.meta || {}) as Record<string, any>;

    const report = await prisma.radiologyReport.create({
      data: {
        id: uuidv4(),
        tenantId,
        orderId,
        encounterId: order.encounterCoreId || null,
        patientId: order.patientMasterId || null,
        examCode: order.orderCode || null,
        examName: order.orderName || null,
        examNameAr: order.orderNameAr || null,
        modality: meta.modality || null,
        bodyPart: meta.bodyPart || null,
        findings,
        impression,
        status: status || 'IN_PROGRESS',
        radiologistId: userId || null,
        hasImages: false,
        reportedAt: status === 'COMPLETED' ? now : null,
        createdByUserId: userId || null,
      },
    });

    // Update order status
    const orderStatus = status === 'COMPLETED' ? 'REPORTED' : status || 'IN_PROGRESS';
    await prisma.ordersHub.update({
      where: { id: orderId },
      data: {
        status: orderStatus,
        completedAt: status === 'COMPLETED' ? now : undefined,
      },
    });

    // Build response with extra fields for backward compatibility
    const reportResponse = {
      ...report,
      findingsAr: findingsAr || null,
      impressionAr: impressionAr || null,
      templateId: templateId || null,
      sections: sections || null,
      radiologist: user?.displayName || user?.email || null,
      completedAt: status === 'COMPLETED' ? now : null,
    };

    logger.info('Radiology report saved', {
      category: 'api',
      tenantId,
      userId,
      route: '/api/radiology/reports/save',
      reportId: report.id,
      orderId,
    });

    return NextResponse.json({ success: true, report: reportResponse });
  }),
  { tenantScoped: true, permissionKey: 'radiology.reports.create' }
);
