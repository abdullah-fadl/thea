import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/infection-control/stats
 * Returns aggregated infection surveillance statistics for the dashboard.
 * Query params:
 *   - days: number of days to look back (default 30)
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(Number(searchParams.get('days') || 30), 7), 365);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const [allRecords, recentRecords] = await Promise.all([
      prisma.infectionSurveillance.findMany({
        where: { tenantId },
        select: {
          infectionType: true,
          onset: true,
          outcome: true,
          isolationPrecautions: true,
          notifiable: true,
          organism: true,
          reportDate: true,
        },
        take: 500,
      }),
      prisma.infectionSurveillance.findMany({
        where: { tenantId, reportDate: { gte: since } },
        select: {
          infectionType: true,
          onset: true,
          outcome: true,
          isolationPrecautions: true,
          notifiable: true,
          organism: true,
          reportDate: true,
        },
        take: 500,
      }),
    ]);

    // --- Aggregate by infection type ---
    const byType: Record<string, { total: number; active: number; resolved: number; hcai: number }> = {};
    for (const r of recentRecords) {
      if (!byType[r.infectionType]) {
        byType[r.infectionType] = { total: 0, active: 0, resolved: 0, hcai: 0 };
      }
      byType[r.infectionType].total += 1;
      if (r.outcome === 'RESOLVED') byType[r.infectionType].resolved += 1;
      else byType[r.infectionType].active += 1;
      if (r.onset === 'HEALTHCARE_ASSOCIATED') byType[r.infectionType].hcai += 1;
    }

    // --- Aggregate by organism ---
    const byOrganism: Record<string, number> = {};
    for (const r of recentRecords) {
      if (r.organism) {
        byOrganism[r.organism] = (byOrganism[r.organism] || 0) + 1;
      }
    }

    // --- Isolation precautions breakdown ---
    const isolationCounts: Record<string, number> = {};
    for (const r of allRecords.filter((r) => r.outcome !== 'RESOLVED')) {
      const precautions = Array.isArray(r.isolationPrecautions) ? r.isolationPrecautions as string[] : [];
      for (const p of precautions) {
        isolationCounts[p] = (isolationCounts[p] || 0) + 1;
      }
    }

    // --- Daily trend (last 14 days) ---
    const trendDays = 14;
    const trendSince = new Date();
    trendSince.setDate(trendSince.getDate() - trendDays);
    const trendRecords = recentRecords.filter((r) => r.reportDate >= trendSince);

    const dailyTrend: Record<string, { date: string; total: number; hcai: number; notifiable: number }> = {};
    for (let i = 0; i < trendDays; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyTrend[key] = { date: key, total: 0, hcai: 0, notifiable: 0 };
    }
    for (const r of trendRecords) {
      const key = r.reportDate.toISOString().slice(0, 10);
      if (dailyTrend[key]) {
        dailyTrend[key].total += 1;
        if (r.onset === 'HEALTHCARE_ASSOCIATED') dailyTrend[key].hcai += 1;
        if (r.notifiable) dailyTrend[key].notifiable += 1;
      }
    }

    // --- Summary totals ---
    const totalActive       = allRecords.filter((r) => r.outcome !== 'RESOLVED').length;
    const totalHcai         = recentRecords.filter((r) => r.onset === 'HEALTHCARE_ASSOCIATED').length;
    const totalNotifiable   = recentRecords.filter((r) => r.notifiable).length;
    const totalIsolation    = allRecords.filter(
      (r) => r.outcome !== 'RESOLVED' && Array.isArray(r.isolationPrecautions) && (r.isolationPrecautions as string[]).length > 0
    ).length;

    return NextResponse.json({
      summary: {
        totalCases: recentRecords.length,
        activeIsolation: totalActive,
        hcaiCases: totalHcai,
        notifiableCases: totalNotifiable,
        patientsInIsolation: totalIsolation,
        periodDays: days,
      },
      byType: Object.entries(byType)
        .map(([type, counts]) => ({ type, ...counts }))
        .sort((a, b) => b.total - a.total),
      byOrganism: Object.entries(byOrganism)
        .map(([organism, count]) => ({ organism, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      isolationBreakdown: Object.entries(isolationCounts)
        .map(([precaution, count]) => ({ precaution, count }))
        .sort((a, b) => b.count - a.count),
      dailyTrend: Object.values(dailyTrend).sort((a, b) => a.date.localeCompare(b.date)),
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'infection_control.view' }
);
