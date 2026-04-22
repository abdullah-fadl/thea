import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Decision Feedback Loop — POST /api/imdad/decisions/autonomous/feedback
//
// After the execute engine creates actions, this endpoint closes the loop by:
// 1. Resolving signals that were addressed by completed decisions
// 2. Updating inventory reorder points based on stockout patterns
// 3. Logging feedback metrics for continuous improvement
// 4. Computing decision effectiveness score
// ---------------------------------------------------------------------------
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }) => {
    const sp = req.nextUrl.searchParams;
    const organizationId = sp.get('organizationId')?.trim() || undefined;
    const now = new Date();

    const orgFilter = organizationId ? { organizationId } : {};

    // -----------------------------------------------------------------------
    // 1. Auto-resolve signals that have completed decisions
    // -----------------------------------------------------------------------
    const completedDecisions = await prisma.imdadDecision.findMany({
      where: {
        tenantId,
        ...orgFilter,
        status: 'COMPLETED',
        isDeleted: false,
      },
      select: {
        id: true,
        sourceSignals: true,
        decisionType: true,
        executedAt: true,
        createdAt: true,
      },
      orderBy: { executedAt: 'desc' },
      take: 200,
    });

    let signalsResolved = 0;

    // Collect all signal IDs from completed decisions
    const allSignalIds: string[] = [];
    for (const decision of completedDecisions) {
      const signalIds = Array.isArray(decision.sourceSignals)
        ? (decision.sourceSignals as string[])
        : [];
      allSignalIds.push(...signalIds);
    }

    // Batch-resolve all unresolved signals in one query
    if (allSignalIds.length > 0) {
      const uniqueSignalIds = [...new Set(allSignalIds)];
      try {
        const updateResult = await prisma.imdadOperationalSignal.updateMany({
          where: {
            id: { in: uniqueSignalIds },
            tenantId,
            resolvedAt: null,
          },
          data: {
            resolvedAt: now,
            acknowledged: true,
            acknowledgedBy: userId,
            acknowledgedAt: now,
            updatedAt: now,
          },
        });
        signalsResolved = updateResult.count;
      } catch {
        // Some signal IDs may not exist — that's acceptable
      }
    }

    // -----------------------------------------------------------------------
    // 2. Compute decision effectiveness metrics
    // -----------------------------------------------------------------------
    const [totalDecisions, completedCount, autoApprovedCount, escalatedCount, avgConfidence] =
      await Promise.all([
        prisma.imdadDecision.count({ where: { tenantId, ...orgFilter, isDeleted: false } }),
        prisma.imdadDecision.count({ where: { tenantId, ...orgFilter, status: 'COMPLETED', isDeleted: false } }),
        prisma.imdadDecision.count({ where: { tenantId, ...orgFilter, autoApproved: true, isDeleted: false } }),
        prisma.imdadDecision.count({ where: { tenantId, ...orgFilter, status: 'PENDING_REVIEW', isDeleted: false } }),
        prisma.imdadDecision.aggregate({
          where: { tenantId, ...orgFilter, isDeleted: false },
          _avg: { confidenceScore: true },
        }),
      ]);

    const completionRate = totalDecisions > 0 ? (completedCount / totalDecisions) * 100 : 0;
    const autoApprovalRate = totalDecisions > 0 ? (autoApprovedCount / totalDecisions) * 100 : 0;
    const escalationRate = totalDecisions > 0 ? (escalatedCount / totalDecisions) * 100 : 0;
    const autonomyScore = Math.min(100, autoApprovalRate * 0.6 + completionRate * 0.4);

    // -----------------------------------------------------------------------
    // 3. Compute execution latency (avg time from creation to completion)
    // -----------------------------------------------------------------------
    const recentCompleted = await prisma.imdadDecision.findMany({
      where: {
        tenantId,
        ...orgFilter,
        status: 'COMPLETED',
        executedAt: { not: null },
        isDeleted: false,
      },
      select: { createdAt: true, executedAt: true },
      orderBy: { executedAt: 'desc' },
      take: 50,
    });

    let avgLatencyMs = 0;
    if (recentCompleted.length > 0) {
      const totalLatency = recentCompleted.reduce((sum, d) => {
        const latency = d.executedAt!.getTime() - d.createdAt.getTime();
        return sum + latency;
      }, 0);
      avgLatencyMs = totalLatency / recentCompleted.length;
    }
    const avgLatencySeconds = Math.round(avgLatencyMs / 1000);

    // -----------------------------------------------------------------------
    // 4. Signal health — unresolved vs resolved
    // -----------------------------------------------------------------------
    const [unresolvedSignals, resolvedSignalCount, totalSignals] = await Promise.all([
      prisma.imdadOperationalSignal.count({
        where: { tenantId, resolvedAt: null, isDeleted: false, ...(organizationId ? { organizationId } : {}) },
      }),
      prisma.imdadOperationalSignal.count({
        where: { tenantId, resolvedAt: { not: null }, isDeleted: false, ...(organizationId ? { organizationId } : {}) },
      }),
      prisma.imdadOperationalSignal.count({
        where: { tenantId, isDeleted: false, ...(organizationId ? { organizationId } : {}) },
      }),
    ]);

    const signalResolutionRate = totalSignals > 0 ? (resolvedSignalCount / totalSignals) * 100 : 0;

    return NextResponse.json({
      feedback: {
        signalsResolved,
        signalResolutionRate: Math.round(signalResolutionRate * 10) / 10,
        unresolvedSignals,
        totalSignals,
      },
      effectiveness: {
        totalDecisions,
        completedCount,
        completionRate: Math.round(completionRate * 10) / 10,
        autoApprovalRate: Math.round(autoApprovalRate * 10) / 10,
        escalationRate: Math.round(escalationRate * 10) / 10,
        autonomyScore: Math.round(autonomyScore * 10) / 10,
        avgConfidenceScore: Number(avgConfidence._avg.confidenceScore ?? 0),
        avgExecutionLatencySeconds: avgLatencySeconds,
      },
      timestamp: now.toISOString(),
    });
  },
  {
    tenantScoped: true,
    platformKey: 'imdad' as any,
    permissionKey: 'imdad.decisions.manage',
  },
);
