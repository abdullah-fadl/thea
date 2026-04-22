import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/care-gaps/stats?patientId=...
 *
 * Returns aggregated care gap statistics.
 * If patientId is provided, returns stats for that specific patient.
 * Otherwise returns tenant-wide stats.
 */
function emptyStats() {
  return NextResponse.json({
    summary: { totalActive: 0, totalOpen: 0, totalContacted: 0, totalScheduled: 0, totalResolved: 0, totalDismissed: 0, recentGapsLast7Days: 0 },
    byType: { labOverdue: 0, radOverdue: 0, followupMissed: 0, procedureOverdue: 0 },
    byPriority: { stat: 0, urgent: 0, routine: 0 },
    outreach: { totalOutreachAttempts: 0 },
  });
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const patientId = req.nextUrl.searchParams.get('patientId');

    try {
      const baseWhere: any = { tenantId };
      if (patientId) baseWhere.patientMasterId = patientId;

      // Run all count queries in parallel
      const [
      totalOpen,
      totalContacted,
      totalScheduled,
      totalResolved,
      totalDismissed,
      labOverdue,
      radOverdue,
      followupMissed,
      procedureOverdue,
      statPriority,
      urgentPriority,
      totalOutreachLogs,
      recentGaps,
    ] = await Promise.all([
      prisma.careGap.count({ where: { ...baseWhere, status: 'OPEN' } }),
      prisma.careGap.count({ where: { ...baseWhere, status: 'CONTACTED' } }),
      prisma.careGap.count({ where: { ...baseWhere, status: 'SCHEDULED' } }),
      prisma.careGap.count({ where: { ...baseWhere, status: 'RESOLVED' } }),
      prisma.careGap.count({ where: { ...baseWhere, status: 'DISMISSED' } }),
      prisma.careGap.count({ where: { ...baseWhere, gapType: 'LAB_OVERDUE', status: { in: ['OPEN', 'CONTACTED'] } } }),
      prisma.careGap.count({ where: { ...baseWhere, gapType: 'RAD_OVERDUE', status: { in: ['OPEN', 'CONTACTED'] } } }),
      prisma.careGap.count({ where: { ...baseWhere, gapType: 'FOLLOWUP_MISSED', status: { in: ['OPEN', 'CONTACTED'] } } }),
      prisma.careGap.count({ where: { ...baseWhere, gapType: 'PROCEDURE_OVERDUE', status: { in: ['OPEN', 'CONTACTED'] } } }),
      prisma.careGap.count({ where: { ...baseWhere, priority: 'STAT', status: { in: ['OPEN', 'CONTACTED'] } } }),
      prisma.careGap.count({ where: { ...baseWhere, priority: 'URGENT', status: { in: ['OPEN', 'CONTACTED'] } } }),
      prisma.careGapOutreachLog.count({ where: { tenantId, ...(patientId ? { careGap: { patientMasterId: patientId } } : {}) } }),
      // Recent gaps (last 7 days)
      prisma.careGap.count({
        where: {
          ...baseWhere,
          status: 'OPEN',
          detectedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const totalActive = totalOpen + totalContacted + totalScheduled;

    return NextResponse.json({
      summary: {
        totalActive,
        totalOpen,
        totalContacted,
        totalScheduled,
        totalResolved,
        totalDismissed,
        recentGapsLast7Days: recentGaps,
      },
      byType: {
        labOverdue,
        radOverdue,
        followupMissed,
        procedureOverdue,
      },
      byPriority: {
        stat: statPriority,
        urgent: urgentPriority,
        routine: totalActive - statPriority - urgentPriority,
      },
      outreach: {
        totalOutreachAttempts: totalOutreachLogs,
      },
    });
    } catch {
      return emptyStats();
    }
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKeys: ['opd.visit.view', 'opd.doctor.encounter.view'],
  }
);
