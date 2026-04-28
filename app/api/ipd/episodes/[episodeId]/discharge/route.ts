import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const dischargeSchema = z.object({
  disposition: z.string().optional(), // HOME, AMA, TRANSFER, DECEASED, etc.
  dischargeNotes: z.string().optional(),
  skipSummaryCheck: z.boolean().optional(), // allow override for emergency
});

/**
 * POST /api/ipd/episodes/[episodeId]/discharge
 * Discharge a patient from an IPD episode.
 * Guard: requires a completed (SIGNED or CO_SIGNED) EnhancedDischargeSummary
 * unless skipSummaryCheck is explicitly true (emergency override).
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
    const routeParams = params || {};
    const episodeId = String((routeParams as Record<string, string>).episodeId || '').trim();
    if (!episodeId) {
      return NextResponse.json(
        { error: 'episodeId is required', errorAr: 'معرف الحلقة مطلوب' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, dischargeSchema);
    if ('error' in v) return v.error;
    const { disposition, dischargeNotes, skipSummaryCheck } = v.data;

    // Verify episode exists and is active
    const episode = await prisma.ipdEpisode.findFirst({
      where: { tenantId, id: episodeId },
    });

    if (!episode) {
      return NextResponse.json(
        { error: 'Episode not found', errorAr: 'الحلقة غير موجودة' },
        { status: 404 }
      );
    }

    if (episode.status === 'DISCHARGED') {
      return NextResponse.json(
        { error: 'Patient already discharged', errorAr: 'تم تخريج المريض مسبقا' },
        { status: 409 }
      );
    }

    // ── Discharge Summary Completion Guard ─────────────────────────────────
    // Require a signed discharge summary before allowing discharge
    if (!skipSummaryCheck) {
      const summary = await prisma.enhancedDischargeSummary.findFirst({
        where: { tenantId, episodeId },
      });

      if (!summary) {
        return NextResponse.json(
          {
            error: 'Discharge summary is required before discharge',
            errorAr: 'ملخص التخريج مطلوب قبل التخريج',
            code: 'DISCHARGE_SUMMARY_MISSING',
          },
          { status: 422 }
        );
      }

      const completedStatuses = ['SIGNED', 'CO_SIGNED', 'COMPLETED'];
      if (!completedStatuses.includes(summary.status)) {
        return NextResponse.json(
          {
            error: `Discharge summary must be completed before discharge (current status: ${summary.status})`,
            errorAr: `يجب اكتمال ملخص التخريج قبل التخريج (الحالة الحالية: ${summary.status})`,
            code: 'DISCHARGE_SUMMARY_INCOMPLETE',
            summaryStatus: summary.status,
          },
          { status: 422 }
        );
      }
    }

    const now = new Date();

    // Update episode status to DISCHARGED
    const updated = await prisma.ipdEpisode.update({
      where: { id: episodeId },
      data: {
        status: 'DISCHARGED',
        closedAt: now,
        updatedByUserId: userId,
        updatedAt: now,
      },
    });

    // Release all active bed admissions for this episode
    await prisma.ipdAdmission.updateMany({
      where: {
        tenantId,
        episodeId,
        isActive: true,
        releasedAt: null,
      },
      data: {
        isActive: false,
        releasedAt: now,
        releasedByUserId: userId,
        dischargeDate: now,
      },
    });

    // Create audit log
    await createAuditLog(
      'IpdEpisode',
      episodeId,
      'PATIENT_DISCHARGED',
      userId,
      user?.email,
      {
        episodeId,
        previousStatus: episode.status,
        newStatus: 'DISCHARGED',
        disposition: disposition || null,
        dischargeNotes: dischargeNotes || null,
        summaryCheckSkipped: skipSummaryCheck || false,
        dischargedAt: now.toISOString(),
      },
      tenantId,
      req
    );

    return NextResponse.json({
      success: true,
      message: 'Patient discharged successfully',
      messageAr: 'تم تخريج المريض بنجاح',
      episode: updated,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.discharge' }
);
