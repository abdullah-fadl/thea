/**
 * SCM Dashboard — Budget Burn Rate
 *
 * GET /api/imdad/dashboard/budget-burn — Budget utilization by month for current fiscal year
 *
 * Uses raw SQL to bypass Prisma model/relation issues and query data directly.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

interface ConsumptionRow {
  month: string;
  consumed: string | number;
  committed: string | number;
}

interface BudgetTotalRow {
  total: string | number;
}

export const GET = withAuthTenant(
  async (_req, { tenantId }) => {
    try {
      const now = new Date();
      const fiscalYearStart = new Date(now.getFullYear(), 0, 1);

      // Get monthly consumed vs committed
      const consumptionRows = await prisma.$queryRaw<ConsumptionRow[]>(
        Prisma.sql`SELECT
           TO_CHAR("createdAt", 'YYYY-MM') AS month,
           COALESCE(SUM(CASE WHEN "isCommitment" = false THEN amount ELSE 0 END), 0)::text AS consumed,
           COALESCE(SUM(CASE WHEN "isCommitment" = true THEN amount ELSE 0 END), 0)::text AS committed
         FROM imdad_budget_consumptions
         WHERE "tenantId" = ${tenantId}::uuid
           AND "isDeleted" = false
           AND "createdAt" >= ${fiscalYearStart}
         GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
         ORDER BY month`
      );

      // Get annual budget total
      const budgetRows = await prisma.$queryRaw<BudgetTotalRow[]>(
        Prisma.sql`SELECT COALESCE(SUM("allocatedAmount"), 0)::text AS total
         FROM imdad_budgets
         WHERE "tenantId" = ${tenantId}::uuid
           AND "isDeleted" = false
           AND "fiscalYear" = ${now.getFullYear()}`
      );

      const annualBudget = Number(budgetRows?.[0]?.total ?? 0);
      const monthlyBudget = annualBudget > 0 ? annualBudget / 12 : 0;

      // Build full month map (Jan to current month)
      const monthMap = new Map<string, { consumed: number; committed: number }>();
      for (let m = 0; m <= now.getMonth(); m++) {
        const key = `${now.getFullYear()}-${String(m + 1).padStart(2, '0')}`;
        monthMap.set(key, { consumed: 0, committed: 0 });
      }

      for (const row of consumptionRows) {
        if (monthMap.has(row.month)) {
          monthMap.set(row.month, {
            consumed: Math.round(Number(row.consumed ?? 0)),
            committed: Math.round(Number(row.committed ?? 0)),
          });
        }
      }

      const data = Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, { consumed, committed }]) => ({
          month,
          consumed,
          committed,
          available: Math.max(0, Math.round(monthlyBudget - consumed - committed)),
        }));

      return NextResponse.json({ data });
    } catch (err: any) {
      console.error('[IMDAD] budget-burn error:', err?.message || err);
      return NextResponse.json({
        data: [],
        _error: process.env.NODE_ENV === 'development' ? err?.message : undefined,
      });
    }
  },
  {
    tenantScoped: true,
    platformKey: 'imdad',
    permissionKey: 'imdad.dashboard.view',
  },
);
