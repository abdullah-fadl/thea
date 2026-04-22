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

  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  const includeVoided = req.nextUrl.searchParams.get('includeVoided') === '1';
  const chargeEvents = await prisma.billingChargeEvent.findMany({
    where: { tenantId, encounterCoreId },
    orderBy: [{ createdAt: 'asc' }],
    take: 200,
  });

  const entries: Array<{
    ts: Date;
    type: 'CHARGE_CREATED' | 'CHARGE_VOIDED';
    refId: string;
    amountDelta: number;
    runningBalance?: number;
    metadata: Record<string, any>;
  }> = [];

  chargeEvents.forEach((event: any) => {
    if (event.status === 'ACTIVE' || includeVoided) {
      entries.push({
        ts: event.createdAt,
        type: 'CHARGE_CREATED',
        refId: event.id,
        amountDelta: Number(event.totalPrice || 0),
        metadata: {
          code: event.code,
          name: event.name,
          department: event.departmentKey,
          source: event.source,
        },
      });
    }

    if (includeVoided && event.status === 'VOID' && event.voidedAt) {
      entries.push({
        ts: event.voidedAt,
        type: 'CHARGE_VOIDED',
        refId: event.id,
        amountDelta: -Number(event.totalPrice || 0),
        metadata: {
          code: event.code,
          name: event.name,
          department: event.departmentKey,
          reason: event.reason || null,
        },
      });
    }
  });

  entries.sort((a, b) => {
    const diff = new Date(a.ts).getTime() - new Date(b.ts).getTime();
    if (diff !== 0) return diff;
    const refDiff = String(a.refId || '').localeCompare(String(b.refId || ''));
    if (refDiff !== 0) return refDiff;
    return String(a.type || '').localeCompare(String(b.type || ''));
  });

  let runningBalance = 0;
  const ledgerEntries = entries.map((entry) => {
    runningBalance = roundMoney(runningBalance + entry.amountDelta);
    return { ...entry, runningBalance };
  });

  return NextResponse.json({
    encounterCoreId,
    entries: ledgerEntries,
    runningBalance,
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
