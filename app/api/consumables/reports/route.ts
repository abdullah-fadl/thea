import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';

const db = prisma;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const view = req.nextUrl.searchParams.get('view') || 'summary';
    const days = parseInt(req.nextUrl.searchParams.get('days') || '30', 10);
    const department = req.nextUrl.searchParams.get('department') || '';

    const since = new Date();
    since.setDate(since.getDate() - days);

    const where: any = {
      tenantId,
      status: 'RECORDED',
      createdAt: { gte: since },
    };
    if (department) where.department = department;

    if (view === 'summary') {
      const events = await db.consumableUsageEvent.findMany({ where, take: 500 });

      const totalEvents = events.length;
      const totalItems = events.reduce((s, e) => s + e.quantity, 0);
      const totalWaste = events.reduce((s, e) => s + (e.wasteQty || 0), 0);
      const totalCost = events.reduce((s, e) => s + Number(e.totalCost || 0), 0);

      // Top consumed items
      const itemCounts: Record<string, { name: string; qty: number; cost: number }> = {};
      for (const e of events) {
        const key = e.supplyCatalogId;
        if (!itemCounts[key]) {
          itemCounts[key] = { name: e.supplyName, qty: 0, cost: 0 };
        }
        itemCounts[key].qty += e.quantity;
        itemCounts[key].cost += Number(e.totalCost || 0);
      }
      const topItems = Object.entries(itemCounts)
        .sort(([, a], [, b]) => b.qty - a.qty)
        .slice(0, 20)
        .map(([id, data]) => ({ supplyCatalogId: id, ...data }));

      // By department
      const deptCounts: Record<string, number> = {};
      for (const e of events) {
        const dept = e.department;
        deptCounts[dept] = (deptCounts[dept] || 0) + e.quantity;
      }
      const byDepartment = Object.entries(deptCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([dept, qty]) => ({ department: dept, quantity: qty }));

      // By context
      const ctxCounts: Record<string, number> = {};
      for (const e of events) {
        const ctx = e.usageContext;
        ctxCounts[ctx] = (ctxCounts[ctx] || 0) + e.quantity;
      }
      const byContext = Object.entries(ctxCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([ctx, qty]) => ({ usageContext: ctx, quantity: qty }));

      // Waste ratio
      const wasteRatio = totalItems > 0 ? Math.round((totalWaste / totalItems) * 10000) / 100 : 0;

      return NextResponse.json({
        period: { days, since: since.toISOString() },
        totalEvents,
        totalItems,
        totalWaste,
        wasteRatio,
        totalCost: Math.round(totalCost * 100) / 100,
        topItems,
        byDepartment,
        byContext,
      });
    }

    // Raw events list
    const events = await db.consumableUsageEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ events });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
