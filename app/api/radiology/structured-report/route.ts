import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ─── Validation ─────────────────────────────────────────────────────── */
const createStructuredReportSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  studyId: z.string().optional(),
  reportType: z.enum(['FREE_TEXT', 'BI_RADS', 'LUNG_RADS', 'TI_RADS', 'PI_RADS', 'LI_RADS']),
  modality: z.string().optional(),
  findings: z.string().optional(),
  impression: z.string().optional(),
  comparisonStudies: z.string().optional(),
  clinicalInfo: z.string().optional(),
  criticalFinding: z.boolean().optional(),
  templateData: z.record(z.string(), z.any()).optional(),
  category: z.string().optional(),
  categoryScore: z.number().optional(),
  recommendation: z.string().optional(),
  status: z.enum(['DRAFT', 'FINAL']).default('DRAFT'),
}).passthrough();

/**
 * GET /api/radiology/structured-report
 *
 * Fetch structured reports with optional filters.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const studyId = req.nextUrl.searchParams.get('studyId');
    const modality = req.nextUrl.searchParams.get('modality');
    const reportType = req.nextUrl.searchParams.get('reportType');
    const orderId = req.nextUrl.searchParams.get('orderId');

    const where: any = { tenantId };
    if (studyId) where.studyId = studyId;
    if (orderId) where.orderId = orderId;
    if (modality) where.modality = modality.toUpperCase();
    if (reportType) where.reportType = reportType;

    const reports = await (prisma as any).radiologyStructuredReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ reports });
  }),
  { tenantScoped: true, permissionKey: 'radiology.view' }
);

/**
 * POST /api/radiology/structured-report
 *
 * Create or save a structured radiology report.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, createStructuredReportSchema);
    if ('error' in v) return v.error;

    const {
      orderId,
      studyId,
      reportType,
      modality,
      findings,
      impression,
      comparisonStudies,
      clinicalInfo,
      criticalFinding,
      templateData,
      category,
      categoryScore,
      recommendation,
      status,
    } = v.data;

    // Fetch the order for context
    const order = await prisma.ordersHub.findFirst({
      where: { tenantId, id: orderId, kind: 'RADIOLOGY' },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const meta = (order.meta || {}) as Record<string, any>;
    const now = new Date();

    const report = await (prisma as any).radiologyStructuredReport.create({
      data: {
        id: uuidv4(),
        tenantId,
        orderId,
        studyId: studyId || null,
        encounterId: order.encounterCoreId || null,
        patientId: order.patientMasterId || null,
        reportType,
        modality: modality || meta.modality || null,
        findings: findings || null,
        impression: impression || null,
        comparisonStudies: comparisonStudies || null,
        clinicalInfo: clinicalInfo || null,
        criticalFinding: criticalFinding || false,
        templateData: templateData || null,
        category: category || null,
        categoryScore: categoryScore ?? null,
        recommendation: recommendation || null,
        status,
        radiologistId: userId || null,
        radiologistName: user?.displayName || user?.email || null,
        reportedAt: status === 'FINAL' ? now : null,
        createdAt: now,
      },
    });

    // Update order status if finalized
    if (status === 'FINAL') {
      await prisma.ordersHub.update({
        where: { id: orderId },
        data: { status: 'REPORTED', completedAt: now },
      });

      // Also create a standard radiology report for backward compatibility
      await prisma.radiologyReport.create({
        data: {
          id: uuidv4(),
          tenantId,
          orderId,
          encounterId: order.encounterCoreId || null,
          patientId: order.patientMasterId || null,
          examCode: order.orderCode || null,
          examName: order.orderName || null,
          examNameAr: order.orderNameAr || null,
          modality: modality || meta.modality || null,
          bodyPart: meta.bodyPart || null,
          findings: findings || null,
          impression: impression || null,
          status: 'REPORTED',
          radiologistId: userId || null,
          hasImages: false,
          reportedAt: now,
          createdByUserId: userId || null,
        },
      });
    }

    return NextResponse.json({ success: true, report });
  }),
  { tenantScoped: true, permissionKey: 'radiology.view' }
);
