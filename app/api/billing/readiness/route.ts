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

  const activeCharges = await prisma.billingChargeEvent.count({
    where: { tenantId, encounterCoreId, status: 'ACTIVE' },
  });
  const voidedCharges = await prisma.billingChargeEvent.count({
    where: { tenantId, encounterCoreId, status: 'VOID' },
  });
  const payerContext = await prisma.billingPayerContext.findFirst({
    where: { tenantId, encounterCoreId },
    select: { id: true },
  });

  let encounterStatusOk = true;
  if (String(encounter.encounterType || '') === 'OPD') {
    const opd = await prisma.opdEncounter.findFirst({
      where: { tenantId, encounterCoreId },
      select: { status: true },
    });
    encounterStatusOk = String(encounter.status || '') === 'CLOSED' || String(opd?.status || '') === 'COMPLETED';
  } else {
    encounterStatusOk = String(encounter.status || '') !== '';
  }

  const reasons: string[] = [];
  if (!activeCharges) reasons.push('NO_ACTIVE_CHARGES');
  if (!payerContext) reasons.push('NO_PAYER_CONTEXT');
  if (!encounterStatusOk) reasons.push('ENCOUNTER_NOT_READY');

  return NextResponse.json({
    encounterCoreId,
    ready: reasons.length === 0,
    reasons,
    metrics: {
      activeCharges,
      voidedCharges,
    },
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
