import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const signReportSchema = z.object({
  signedByUserId: z.string().min(1, 'signedByUserId is required'),
  findings: z.string().optional(),
  impression: z.string().optional(),
  addendum: z.string().optional(),
});

/**
 * POST /api/radiology/reports/[reportId]/sign
 * Sign / finalize a radiology report — updates status to FINAL with signedAt timestamp.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
    const resolved = params instanceof Promise ? await params : params;
    const reportId = resolved?.reportId as string;

    if (!reportId) {
      return NextResponse.json(
        { error: 'Report ID is required', errorAr: 'معرف التقرير مطلوب' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, signReportSchema);
    if ('error' in v) return v.error;
    const { signedByUserId, findings, impression, addendum } = v.data;

    // Find the report
    const report = await prisma.radiologyReport.findFirst({
      where: { id: reportId, tenantId },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Radiology report not found', errorAr: 'تقرير الأشعة غير موجود' },
        { status: 404 }
      );
    }

    const reportRecord = report as Record<string, unknown>;
    const status = reportRecord.status as string;
    if (!['DRAFT', 'PRELIMINARY', 'PENDING', 'IN_PROGRESS', 'REPORTED'].includes(status)) {
      return NextResponse.json(
        {
          error: 'Report is not in a valid status for signing',
          errorAr: 'حالة التقرير لا تسمح بالتوقيع',
        },
        { status: 409 }
      );
    }

    const now = new Date();

    // Build update data
    const updateData: Record<string, any> = {
      status: 'VERIFIED',
      verifiedAt: now,
      verifiedBy: signedByUserId,
    };

    if (findings !== undefined) {
      updateData.findings = findings;
    }
    if (impression !== undefined) {
      updateData.impression = impression;
    }

    // Update the report
    const updated = await prisma.radiologyReport.update({
      where: { id: reportId },
      data: updateData,
    });

    // If addendum is provided, create a clinical note for it
    if (addendum) {
      await prisma.clinicalNote.create({
        data: {
          tenantId,
          patientMasterId: (reportRecord.patientId as string) || undefined,
          encounterCoreId: (reportRecord.encounterId as string) || undefined,
          noteType: 'RADIOLOGY_ADDENDUM',
          title: `Radiology Addendum - ${(reportRecord.examName as string) || reportId}`,
          content: addendum,
          context: 'radiology',
          area: 'radiology',
          role: 'radiologist',
          author: {
            userId: signedByUserId,
            name: ((user as unknown as Record<string, unknown> | undefined)?.name as string) || user?.email || signedByUserId,
            role: 'radiologist',
          },
          createdByUserId: signedByUserId,
        },
      }).catch(() => {});
    }

    // Create audit log
    await createAuditLog(
      'RadiologyReport',
      reportId,
      'RADIOLOGY_REPORT_SIGNED',
      userId,
      user?.email,
      {
        reportId,
        previousStatus: status,
        newStatus: 'VERIFIED',
        signedByUserId,
        signedAt: now.toISOString(),
        findingsUpdated: findings !== undefined,
        impressionUpdated: impression !== undefined,
        hasAddendum: !!addendum,
      },
      tenantId,
      req
    );

    return NextResponse.json({
      success: true,
      message: 'Radiology report signed successfully',
      messageAr: 'تم توقيع تقرير الأشعة بنجاح',
      report: updated,
    });
  }),
  { tenantScoped: true, permissionKey: 'radiology.reports.create' }
);
