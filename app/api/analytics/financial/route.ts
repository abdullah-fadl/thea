import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string; userId: string }) => {
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get('days') || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [invoices, payments] = await Promise.all([
      prisma.billingInvoice
        .findMany({
          where: { tenantId, createdAt: { gte: startDate } },
          select: { total: true, status: true, createdAt: true },
        })
        .catch(() => [] as Array<{ total: unknown; status: string; createdAt: Date }>),
      prisma.billingPayment
        .findMany({
          where: { tenantId, createdAt: { gte: startDate } },
          select: { amount: true, method: true, createdAt: true },
        })
        .catch(() => [] as Array<{ amount: unknown; method: string; createdAt: Date }>),
    ]);

    const totalBilled = (invoices as Array<{ total: unknown }>).reduce(
      (sum: number, i) => sum + (Number(i.total) || 0),
      0,
    );
    const totalCollected = (payments as Array<{ amount: unknown; method: string }>).reduce(
      (sum: number, p) => sum + (Number(p.amount) || 0),
      0,
    );

    const byMethod: Record<string, number> = {};
    for (const p of payments as Array<{ amount: unknown; method: string }>) {
      const method = p.method || 'UNKNOWN';
      byMethod[method] = (byMethod[method] || 0) + (Number(p.amount) || 0);
    }

    return NextResponse.json({
      totalBilled,
      totalCollected,
      collectionRate:
        totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0,
      invoiceCount: invoices.length,
      paymentCount: payments.length,
      byMethod,
    });
  }),
  { permissionKey: 'analytics.view' },
);
