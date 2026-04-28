/**
 * SCM Dashboard — Spend Trend
 *
 * GET /api/imdad/dashboard/spend-trend — Monthly procurement spend for last 12 months
 *
 * Uses raw SQL to bypass Prisma model/relation issues and query data directly.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

interface SpendRow {
  month: string;
  amount: string | number;
}

export const GET = withAuthTenant(
  async (_req, { tenantId }) => {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    try {
      // Query monthly spend from purchase orders (approved/received/closed)
      const rows = await prisma.$queryRaw<SpendRow[]>(
        Prisma.sql`SELECT
           TO_CHAR("createdAt", 'YYYY-MM') AS month,
           COALESCE(SUM("totalAmount"), 0)::text AS amount
         FROM imdad_purchase_orders
         WHERE "tenantId" = ${tenantId}::uuid
           AND "isDeleted" = false
           AND status IN ('APPROVED', 'RECEIVED', 'CLOSED', 'INVOICED', 'PARTIALLY_RECEIVED')
           AND "createdAt" >= ${twelveMonthsAgo}
         GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
         ORDER BY month`
      );

      // Build full 12-month map with zeros for missing months
      const monthMap = new Map<string, number>();
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthMap.set(key, 0);
      }

      for (const row of rows) {
        if (monthMap.has(row.month)) {
          monthMap.set(row.month, Math.round(Number(row.amount ?? 0)));
        }
      }

      const data = Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({ month, amount }));

      return NextResponse.json({ data });
    } catch (err: any) {
      console.error('[IMDAD] spend-trend error:', err?.message || err);
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
