import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { computeTATMetrics, type LabTimestamps } from '@/lib/lab/tatTracking';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/lab/tat-metrics?period=today|week|month&department=Hematology&targetMinutes=90
 *
 * Returns aggregate TAT metrics for lab orders.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const period = req.nextUrl.searchParams.get('period') || 'today';
    const department = req.nextUrl.searchParams.get('department') || undefined;
    const targetMinutes = Number(req.nextUrl.searchParams.get('targetMinutes') || 90);

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
    }

    const where: any = {
      tenantId,
      kind: 'LAB',
      createdAt: { gte: startDate },
    };

    // Filter by department stored in meta JSON
    // Note: Prisma JSON path filtering — meta->department
    if (department) {
      where.meta = { path: ['department'], equals: department };
    }

    const orders = await prisma.ordersHub.findMany({
      where,
      select: {
        orderedAt: true,
        createdAt: true,
        meta: true,
        completedAt: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const orderData = orders.map((o: any) => ({
      timestamps: {
        orderedAt: o.orderedAt || o.createdAt,
        collectedAt: o.meta?.collectedAt,
        receivedAt: o.meta?.receivedAt,
        inProgressAt: o.meta?.inProgressAt,
        resultedAt: o.meta?.resultedAt || (o.status === 'COMPLETED' ? o.completedAt : undefined),
        verifiedAt: o.meta?.verifiedAt,
      } as LabTimestamps,
      department: o.meta?.department,
    }));

    const metrics = computeTATMetrics(orderData, targetMinutes, period);

    return NextResponse.json({ metrics });
  }),
  { tenantScoped: true, permissionKey: 'lab.results.view' },
);
