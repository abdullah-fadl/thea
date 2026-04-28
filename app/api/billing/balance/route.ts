import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const encounterCoreId = String(req.nextUrl.searchParams.get('encounterCoreId') || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  const chargesAgg = await prisma.billingChargeEvent.aggregate({
    where: { tenantId, encounterCoreId, status: 'ACTIVE' },
    _sum: { totalPrice: true },
  });
  const grandTotalActive = Number(chargesAgg._sum.totalPrice || 0);

  const paymentsAgg = await prisma.billingPayment.aggregate({
    where: { tenantId, encounterCoreId, status: 'RECORDED' },
    _sum: { amount: true },
    _count: true,
  });
  const paidRecorded = Number(paymentsAgg._sum.amount || 0);
  const paymentsCount = Number(paymentsAgg._count || 0);

  const balance = Number((grandTotalActive - paidRecorded).toFixed(2));

  return NextResponse.json({
    encounterCoreId,
    grandTotalActive: Number(grandTotalActive.toFixed(2)),
    paidRecorded: Number(paidRecorded.toFixed(2)),
    balance,
    paymentsCount,
    asOf: new Date().toISOString(),
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
