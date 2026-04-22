import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const patientId = String((params as { id?: string } | undefined)?.id || '').trim();
  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
  }

  const orders = await prisma.ordersHub.findMany({
    where: {
      tenantId,
      patientMasterId: patientId,
      kind: { in: ['LAB', 'RADIOLOGY', 'PROCEDURE'] },
      status: { not: 'CANCELLED' },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const orderIds = orders.map((order: any) => String(order.id || '')).filter(Boolean);
  const results = orderIds.length
    ? await prisma.orderResult.findMany({
        where: { tenantId, orderId: { in: orderIds } },
        select: { orderId: true, status: true },
      })
    : [];

  const hasResult = results.reduce<Record<string, boolean>>((acc, result) => {
    acc[String(result.orderId || '')] = true;
    return acc;
  }, {});

  const pending = orders.filter((order: any) => !hasResult[String(order.id || '')]);

  const items = pending.map((order: any) => ({
    id: order.id,
    orderCode: order.orderCode,
    orderName: order.orderName,
    kind: order.kind,
    orderedAt: order.createdAt || order.requestedAt,
  }));

  return NextResponse.json({ items });
}),
  { tenantScoped: true, permissionKeys: ['clinical.view', 'opd.doctor.encounter.view', 'opd.doctor.visit.view', 'opd.nursing.edit', 'opd.visit.view'] }
);
