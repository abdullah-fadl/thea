/**
 * Imdad Budget Governance — Cross-Hospital Benchmarks
 * المقارنة المعيارية بين المستشفيات
 *
 * GET  /api/imdad/budget-governance/benchmarks — Get benchmarks with network stats
 * POST /api/imdad/budget-governance/benchmarks — Calculate & store benchmarks
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const organizationId = url.searchParams.get('organizationId');
    const fiscalYear = url.searchParams.get('fiscalYear') || String(new Date().getFullYear());
    const metric = url.searchParams.get('metric');

    const where: Record<string, unknown> = {
      tenantId,
      isDeleted: false,
      fiscalYear: parseInt(fiscalYear),
    };
    if (organizationId) where.organizationId = organizationId;
    if (metric) where.metric = metric;

    const benchmarks = await prisma.imdadBudgetBenchmark.findMany({
      where: where as any,
      orderBy: [{ metric: 'asc' }, { percentileRank: 'desc' }],
      take: 500,
    });

    // Group by metric for overview
    const byMetric = new Map<string, typeof benchmarks>();
    for (const b of benchmarks) {
      const existing = byMetric.get(b.metric) || [];
      existing.push(b);
      byMetric.set(b.metric, existing);
    }

    const metricSummaries = Array.from(byMetric.entries()).map(([m, items]) => {
      const values = items.map(i => Number(i.metricValue));
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      const sorted = [...values].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      return {
        metric: m,
        hospitalCount: items.length,
        average: Math.round(avg * 100) / 100,
        median: Math.round(median * 100) / 100,
        best: Math.min(...values),
        worst: Math.max(...values),
      };
    });

    return NextResponse.json({ data: benchmarks, metricSummaries });
  },
  { tenantScoped: true, platformKey: 'imdad', permissionKey: 'imdad.budget.view' },
);

const createSchema = z.object({
  organizationId: z.string().uuid(),
  annualPlanId: z.string().uuid().optional(),
  fiscalYear: z.number().int().min(2020).max(2040),
  metric: z.enum([
    'COST_PER_BED', 'EQUIPMENT_AGE_RATIO', 'MAINTENANCE_COST_RATIO',
    'SUPPLY_COST_PER_PATIENT', 'UTILIZATION_RATE', 'DOWNTIME_RATIO',
    'PROCUREMENT_CYCLE_TIME', 'BUDGET_VARIANCE',
  ]),
  metricValue: z.number(),
  networkAverage: z.number().optional(),
  networkMedian: z.number().optional(),
  networkBest: z.number().optional(),
  networkWorst: z.number().optional(),
  percentileRank: z.number().min(0).max(100).optional(),
  trend: z.string().optional(),
  trendAr: z.string().optional(),
  departmentId: z.string().uuid().optional(),
});

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId }) => {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    try {
      const benchmark = await prisma.imdadBudgetBenchmark.create({
        data: {
          tenantId,
          organizationId: d.organizationId,
          annualPlanId: d.annualPlanId,
          fiscalYear: d.fiscalYear,
          metric: d.metric,
          metricValue: d.metricValue,
          networkAverage: d.networkAverage,
          networkMedian: d.networkMedian,
          networkBest: d.networkBest,
          networkWorst: d.networkWorst,
          percentileRank: d.percentileRank,
          trend: d.trend,
          trendAr: d.trendAr,
          departmentId: d.departmentId,
        } as any,
      });

      return NextResponse.json({ data: benchmark }, { status: 201 });
    } catch (err: any) {
      console.error('[Benchmarks] Create error:', err);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'imdad', permissionKey: 'imdad.budget.create' },
);
