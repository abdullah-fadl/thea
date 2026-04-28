import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 5 minutes in milliseconds
const PULSE_STALENESS_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// GET /api/imdad/decisions/pulse — System pulse / health dashboard
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const sp = req.nextUrl.searchParams;
    const organizationId = sp.get('organizationId')?.trim() || undefined;

    const orgFilter: Record<string, unknown> = { tenantId };
    if (organizationId) orgFilter.organizationId = organizationId;

    // --- Check for a recent cached pulse ---
    const existingPulse = await prisma.imdadSystemPulse.findFirst({
      where: orgFilter,
      orderBy: { pulseTimestamp: 'desc' },
    }).catch(() => null);

    if (existingPulse) {
      const age = Date.now() - new Date(existingPulse.pulseTimestamp).getTime();
      if (age < PULSE_STALENESS_MS) {
        return NextResponse.json({ pulse: existingPulse });
      }
    }

    // --- Generate a fresh pulse ---
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const activeStatuses = ['GENERATED', 'PENDING_REVIEW', 'AUTO_APPROVED', 'EXECUTING'];

    const [
      activeDecisions,
      pendingActions,
      criticalSignals24h,
      highSignals24h,
      totalAssets,
      assetsAtRisk,
      totalDecisionsAllTime,
      approvedDecisions,
      completedDecisions,
      rejectedDecisions,
    ] = await Promise.all([
      // Active decisions
      prisma.imdadDecision.count({
        where: { ...orgFilter as any, status: { in: activeStatuses } },
      }),
      // Pending actions
      prisma.imdadDecisionAction.count({
        where: { ...orgFilter, status: 'PENDING' },
      }).catch(() => 0),
      // Critical signals (24h)
      prisma.imdadOperationalSignal.count({
        where: { ...orgFilter, severity: 'CRITICAL', createdAt: { gte: twentyFourHoursAgo } },
      }),
      // High signals (24h)
      prisma.imdadOperationalSignal.count({
        where: { ...orgFilter, severity: 'HIGH', createdAt: { gte: twentyFourHoursAgo } },
      }),
      // Total assets
      prisma.imdadAsset.count({ where: orgFilter }).catch(() => 0),
      // Assets at risk (lifecycle exceeded)
      prisma.imdadAsset.count({
        where: { ...orgFilter, lifecycleEndDate: { lt: now } } as any,
      }).catch(() => 0),
      // All-time decisions
      prisma.imdadDecision.count({ where: orgFilter }),
      // Approved decisions
      prisma.imdadDecision.count({
        where: { ...orgFilter, status: { in: ['APPROVED', 'AUTO_APPROVED'] } },
      }),
      // Completed decisions
      prisma.imdadDecision.count({
        where: { ...orgFilter, status: 'COMPLETED' },
      }),
      // Rejected decisions
      prisma.imdadDecision.count({
        where: { ...orgFilter, status: 'REJECTED' },
      }),
    ]);

    const criticalHighSignals = criticalSignals24h + highSignals24h;

    // --- Calculate health scores (0-100) ---
    const inventoryHealth = totalAssets > 0
      ? Math.round(((totalAssets - assetsAtRisk) / totalAssets) * 100)
      : 100;

    const budgetHealth = totalDecisionsAllTime > 0
      ? Math.round(Math.max(0, 100 - (rejectedDecisions / totalDecisionsAllTime) * 100))
      : 100;

    const complianceHealth = totalDecisionsAllTime > 0
      ? Math.round((completedDecisions / Math.max(1, completedDecisions + rejectedDecisions)) * 100)
      : 100;

    const overallHealth = Math.round((inventoryHealth + budgetHealth + complianceHealth) / 3);

    // --- Operational pressure: signals / assets ratio * 100 ---
    const operationalPressure = totalAssets > 0
      ? Math.round((criticalHighSignals / totalAssets) * 100 * 10) / 10
      : criticalHighSignals > 0 ? 100 : 0;

    // --- Trend direction ---
    let trendDirection: 'IMPROVING' | 'STABLE' | 'DECLINING' = 'STABLE';
    if (existingPulse) {
      const prevHealth = Number((existingPulse as any).overallHealthScore ?? 0);
      if (overallHealth > prevHealth + 2) trendDirection = 'IMPROVING';
      else if (overallHealth < prevHealth - 2) trendDirection = 'DECLINING';
    }

    // --- Persist the pulse ---
    // If no organizationId provided, return computed pulse without persisting
    if (!organizationId) {
      return NextResponse.json({
        pulse: {
          activeDecisions,
          pendingActions,
          criticalSignals: criticalSignals24h,
          highSignals: highSignals24h,
          totalAssets,
          assetsAtRisk,
          inventoryHealth,
          budgetHealth,
          complianceHealth,
          overallHealthScore: overallHealth,
          operationalPressure,
          trendDirection,
        },
      });
    }

    const pulse = await prisma.imdadSystemPulse.create({
      data: {
        tenantId,
        organizationId,
        pulseTimestamp: now,
        activeDecisions,
        pendingActions,
        criticalSignals: criticalSignals24h,
        highSignals: highSignals24h,
        totalAssets,
        assetsAtRisk,
        inventoryHealth,
        budgetHealth,
        complianceHealth,
        overallHealthScore: overallHealth,
        operationalPressure,
        trendDirection,
        createdAt: now,
      } as any,
    });

    return NextResponse.json({ pulse });
  }),
  {
    tenantScoped: true,
    platformKey: 'imdad' as any,
    permissionKey: 'imdad.decisions.view',
  },
);
