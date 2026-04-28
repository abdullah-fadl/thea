import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/imdad/decisions/autonomous/history
// Returns autonomous operation history: recent pulses, decisions, signals
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }) => {
    const sp = req.nextUrl.searchParams;
    const organizationId = sp.get('organizationId')?.trim() || undefined;
    const limit = Math.min(Number(sp.get('limit') || 20), 100);

    const orgFilter = organizationId ? { organizationId } : {};

    // Parallel queries for performance
    const [recentPulses, recentSignals, decisionStats, actionStats] = await Promise.all([
      // Last N pulses
      prisma.imdadSystemPulse.findMany({
        where: { tenantId, ...orgFilter },
        orderBy: { pulseTimestamp: 'desc' },
        take: limit,
      }),

      // Last N signals
      prisma.imdadOperationalSignal.findMany({
        where: { tenantId, isDeleted: false, ...(organizationId ? { organizationId } : {}) },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          signalCode: true,
          signalType: true,
          severity: true,
          title: true,
          titleAr: true,
          sourceEntity: true,
          metricValue: true,
          threshold: true,
          deviationPct: true,
          acknowledged: true,
          createdAt: true,
        },
      }),

      // Decision status distribution
      prisma.imdadDecision.groupBy({
        by: ['status'],
        where: { tenantId, isDeleted: false, ...(organizationId ? { organizationId } : {}) },
        _count: true,
      }),

      // Action status distribution
      prisma.imdadDecisionAction.groupBy({
        by: ['status'],
        where: { tenantId, isDeleted: false, ...(organizationId ? { organizationId } : {}) },
        _count: true,
      }),
    ]);

    // Aggregate decision stats
    const decisionStatusMap: Record<string, number> = {};
    for (const g of decisionStats) {
      decisionStatusMap[g.status] = g._count;
    }

    const actionStatusMap: Record<string, number> = {};
    for (const g of actionStats) {
      actionStatusMap[g.status] = g._count;
    }

    return NextResponse.json({
      pulses: recentPulses,
      signals: recentSignals,
      decisionStats: decisionStatusMap,
      actionStats: actionStatusMap,
      totals: {
        totalDecisions: Object.values(decisionStatusMap).reduce((s, v) => s + v, 0),
        totalActions: Object.values(actionStatusMap).reduce((s, v) => s + v, 0),
        totalSignals: recentSignals.length,
        autoExecuted: (decisionStatusMap['COMPLETED'] ?? 0),
        pendingReview: (decisionStatusMap['PENDING_REVIEW'] ?? 0),
        active: (decisionStatusMap['GENERATED'] ?? 0) + (decisionStatusMap['AUTO_APPROVED'] ?? 0) + (decisionStatusMap['APPROVED'] ?? 0) + (decisionStatusMap['EXECUTING'] ?? 0),
      },
    });
  },
  {
    tenantScoped: true,
    platformKey: 'imdad' as any,
    permissionKey: 'imdad.decisions.view',
  },
);
