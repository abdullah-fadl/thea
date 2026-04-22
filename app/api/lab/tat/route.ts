import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface TATBreakdown {
  testName: string;
  category: string;
  count: number;
  avgOrderToCollect: number;
  avgCollectToReceive: number;
  avgReceiveToResult: number;
  avgResultToVerify: number;
  avgTotal: number;
  targetMinutes: number;
  withinTarget: number;
  withinTargetPct: number;
}

function minutesDiff(a: string | Date | null | undefined, b: string | Date | null | undefined): number | null {
  if (!a || !b) return null;
  const diff = (new Date(b).getTime() - new Date(a).getTime()) / 60000;
  return diff >= 0 ? diff : null;
}

/**
 * GET /api/lab/tat?from=ISO&to=ISO&category=Chemistry
 *
 * Aggregates TAT data from lab orders. Calculates timestamps between
 * order -> collect -> receive -> result -> verify.
 * Returns summary stats: avg TAT by category, within-target percentage, worst performers.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const fromParam = req.nextUrl.searchParams.get('from');
    const toParam = req.nextUrl.searchParams.get('to');
    const category = req.nextUrl.searchParams.get('category');

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const from = fromParam ? new Date(fromParam) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const to = toParam ? new Date(toParam) : now;

    // Try labTatRecord first (pre-computed TAT data)
    let tatRecords: any[] = [];
    try {
      const tatWhere: any = {
        tenantId,
        createdAt: { gte: from, lte: to },
      };
      if (category && category !== 'All') {
        tatWhere.category = category;
      }

      tatRecords = await prisma.labTatRecord.findMany({
        where: tatWhere,
        orderBy: { createdAt: 'desc' },
        take: 2000,
      });
    } catch {
      // labTatRecord model may not exist yet, fall back to ordersHub
    }

    // Fallback: compute from ordersHub if no TAT records
    if (tatRecords.length === 0) {
      const orderWhere: any = {
        tenantId,
        kind: 'LAB',
        createdAt: { gte: from, lte: to },
      };
      if (category && category !== 'All') {
        orderWhere.meta = { path: ['department'], equals: category };
      }

      const orders = await prisma.ordersHub.findMany({
        where: orderWhere,
        select: {
          id: true,
          orderName: true,
          meta: true,
          createdAt: true,
          completedAt: true,
          status: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 2000,
      });

      tatRecords = orders.map((o: any) => ({
        testName: o.name ?? o.meta?.testName ?? 'Unknown',
        category: o.meta?.department ?? 'General',
        orderedAt: o.createdAt,
        collectedAt: o.meta?.collectedAt ?? null,
        receivedAt: o.meta?.receivedAt ?? null,
        resultedAt: o.meta?.resultedAt ?? (o.status === 'COMPLETED' ? o.completedAt : null),
        verifiedAt: o.meta?.verifiedAt ?? null,
        targetMinutes: o.meta?.targetMinutes ?? 90,
        createdAt: o.createdAt,
      }));
    }

    // Group by testName + category and compute aggregates
    const groups = new Map<string, any[]>();
    for (const rec of tatRecords) {
      const key = `${rec.testName}__${rec.category}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(rec);
    }

    const breakdowns: TATBreakdown[] = [];
    let totalOrders = 0;
    let totalWithinTarget = 0;
    let totalTATSum = 0;
    let totalTATCount = 0;
    let criticalAlertCount = 0;

    for (const [, records] of groups) {
      const first = records[0];
      let sumOC = 0, cntOC = 0;
      let sumCR = 0, cntCR = 0;
      let sumRR = 0, cntRR = 0;
      let sumRV = 0, cntRV = 0;
      let sumTotal = 0, cntTotal = 0;
      let withinTarget = 0;
      const target = first.targetMinutes ?? 90;

      for (const r of records) {
        const oc = minutesDiff(r.orderedAt, r.collectedAt);
        const cr = minutesDiff(r.collectedAt, r.receivedAt);
        const rr = minutesDiff(r.receivedAt, r.resultedAt);
        const rv = minutesDiff(r.resultedAt, r.verifiedAt);

        if (oc !== null) { sumOC += oc; cntOC++; }
        if (cr !== null) { sumCR += cr; cntCR++; }
        if (rr !== null) { sumRR += rr; cntRR++; }
        if (rv !== null) { sumRV += rv; cntRV++; }

        const total = minutesDiff(r.orderedAt, r.verifiedAt ?? r.resultedAt);
        if (total !== null) {
          sumTotal += total;
          cntTotal++;
          totalTATSum += total;
          totalTATCount++;
          if (total <= target) {
            withinTarget++;
            totalWithinTarget++;
          }
          if (total > target * 2) {
            criticalAlertCount++;
          }
        }
      }

      totalOrders += records.length;

      breakdowns.push({
        testName: first.testName ?? 'Unknown',
        category: first.category ?? 'General',
        count: records.length,
        avgOrderToCollect: cntOC > 0 ? Math.round(sumOC / cntOC) : 0,
        avgCollectToReceive: cntCR > 0 ? Math.round(sumCR / cntCR) : 0,
        avgReceiveToResult: cntRR > 0 ? Math.round(sumRR / cntRR) : 0,
        avgResultToVerify: cntRV > 0 ? Math.round(sumRV / cntRV) : 0,
        avgTotal: cntTotal > 0 ? Math.round(sumTotal / cntTotal) : 0,
        targetMinutes: target,
        withinTarget,
        withinTargetPct: records.length > 0 ? Math.round((withinTarget / records.length) * 100) : 0,
      });
    }

    // Sort by avg total TAT descending (worst first)
    breakdowns.sort((a, b) => b.avgTotal - a.avgTotal);

    // Count today's orders
    const ordersToday = tatRecords.filter((r: any) => new Date(r.createdAt) >= todayStart).length;

    return NextResponse.json({
      breakdowns,
      summary: {
        avgTotalTAT: totalTATCount > 0 ? Math.round(totalTATSum / totalTATCount) : 0,
        withinTargetPct: totalOrders > 0 ? Math.round((totalWithinTarget / totalOrders) * 100) : 0,
        ordersToday,
        criticalAlerts: criticalAlertCount,
        totalOrders,
      },
    });
  }),
  { tenantScoped: true, permissionKey: 'lab.view' },
);
