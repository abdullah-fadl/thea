import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const encounterCoreId = String(req.nextUrl.searchParams.get('encounterCoreId') || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const chargeEvents = await prisma.billingChargeEvent.findMany({
    where: { tenantId, encounterCoreId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 200,
  });
  const payerContext = await prisma.billingPayerContext.findFirst({
    where: { tenantId, encounterCoreId },
  });

  const counts = {
    active: chargeEvents.filter((item: any) => item.status === 'ACTIVE').length,
    voided: chargeEvents.filter((item: any) => item.status === 'VOID').length,
    total: chargeEvents.length,
  };

  const activeEvents = chargeEvents.filter((item: any) => item.status === 'ACTIVE');
  const orderIds = Array.from(
    new Set(activeEvents.map((item: any) => {
      const src = item.source as Record<string, unknown>;
      return String(src?.orderId || '');
    }).filter(Boolean))
  );
  const orders = orderIds.length
    ? await prisma.ordersHub.findMany({
        where: { tenantId, id: { in: orderIds } },
        select: { id: true, kind: true },
      })
    : [];

  const orderKindById = orders.reduce<Record<string, string>>((acc, order: any) => {
    acc[String(order.id || '')] = String(order.kind || 'UNKNOWN');
    return acc;
  }, {});

  let grandTotal = 0;
  const departmentTotals: Record<string, number> = {};
  const kindTotals: Record<string, number> = {};

  activeEvents.forEach((item: any) => {
    const total = Number(item.totalPrice || 0);
    grandTotal += total;
    const department = String(item.departmentKey || 'OTHER');
    departmentTotals[department] = roundMoney((departmentTotals[department] || 0) + total);

    let kind = 'MANUAL';
    const src = item.source as Record<string, unknown>;
    if (String(src?.type || '') === 'ORDER') {
      kind = orderKindById[String(src?.orderId || '')] || 'UNKNOWN';
    }
    kindTotals[kind] = roundMoney((kindTotals[kind] || 0) + total);
  });

  const byDepartment = Object.keys(departmentTotals)
    .sort()
    .map((key) => ({ departmentKey: key, total: departmentTotals[key] }));
  const byOrderKind = Object.keys(kindTotals)
    .sort()
    .map((key) => ({ kind: key, total: kindTotals[key] }));

  return NextResponse.json({
    encounterCoreId,
    totals: {
      grandTotal: roundMoney(grandTotal),
      byDepartment,
      byOrderKind,
    },
    counts,
    payerContext: payerContext || null,
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
