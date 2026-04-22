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

function formatDateStamp(date: Date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

interface ChargeSource {
  type?: string;
  orderId?: string;
  orderItemId?: string;
}

type ChargeEvent = Awaited<ReturnType<typeof prisma.billingChargeEvent.findMany>>[number];

function getSource(item: ChargeEvent): ChargeSource {
  const src = item.source;
  if (src && typeof src === 'object' && !Array.isArray(src)) return src as unknown as ChargeSource;
  return {};
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
  const includeVoided = req.nextUrl.searchParams.get('includeVoided') === '1';

  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  const payerContext = await prisma.billingPayerContext.findFirst({
    where: { tenantId, encounterCoreId },
  });
  const lock = await prisma.billingLock.findFirst({
    where: { tenantId, encounterCoreId },
  });
  const posting = await prisma.billingPosting.findFirst({
    where: { tenantId, encounterCoreId },
  });

  const chargeEvents = await prisma.billingChargeEvent.findMany({
    where: { tenantId, encounterCoreId },
    orderBy: [{ createdAt: 'asc' }],
    take: 200,
  });

  const counts = {
    active: chargeEvents.filter((item) => item.status === 'ACTIVE').length,
    voided: chargeEvents.filter((item) => item.status === 'VOID').length,
    total: chargeEvents.length,
  };
  let encounterStatusOk = true;
  if (String(encounter.encounterType || '') === 'OPD') {
    const opd = await prisma.opdEncounter.findFirst({
      where: { tenantId, encounterCoreId },
      select: { status: true },
    });
    encounterStatusOk = String(encounter.status || '') === 'CLOSED' || String(opd?.status || '') === 'COMPLETED';
  }
  const readinessReasons: string[] = [];
  if (!counts.active) readinessReasons.push('NO_ACTIVE_CHARGES');
  if (!payerContext) readinessReasons.push('NO_PAYER_CONTEXT');
  if (!encounterStatusOk) readinessReasons.push('ENCOUNTER_NOT_READY');
  const readiness = {
    encounterCoreId,
    ready: readinessReasons.length === 0,
    reasons: readinessReasons,
    metrics: { activeCharges: counts.active, voidedCharges: counts.voided },
  };

  const activeEvents = chargeEvents.filter((item) => item.status === 'ACTIVE');
  const visibleEvents = includeVoided ? chargeEvents : activeEvents;

  const orderIds = Array.from(
    new Set(
      visibleEvents
        .filter((item) => String(getSource(item).type || '') === 'ORDER')
        .map((item) => String(getSource(item).orderId || ''))
        .filter(Boolean)
    )
  );
  const orders = orderIds.length
    ? await prisma.ordersHub.findMany({
        where: { tenantId, id: { in: orderIds } },
        select: { id: true, orderCode: true, kind: true },
      })
    : [];
  const orderById = orders.reduce<Record<string, (typeof orders)[number]>>((acc, order) => {
    acc[String(order.id || '')] = order;
    return acc;
  }, {});

  let grandTotalActive = 0;
  const byDepartmentTotals: Record<string, { total: number; count: number }> = {};
  const byOrderKindTotals: Record<string, { total: number; count: number }> = {};

  activeEvents.forEach((item) => {
    const total = Number(item.totalPrice || 0);
    grandTotalActive += total;
    const dept = String(item.departmentKey || 'OTHER');
    byDepartmentTotals[dept] = byDepartmentTotals[dept] || { total: 0, count: 0 };
    byDepartmentTotals[dept].total = roundMoney(byDepartmentTotals[dept].total + total);
    byDepartmentTotals[dept].count += 1;

    let kind = 'MANUAL';
    const src = getSource(item);
    if (String(src.type || '') === 'ORDER') {
      const order = orderById[String(src.orderId || '')];
      kind = order?.kind || 'UNKNOWN';
    }
    byOrderKindTotals[kind] = byOrderKindTotals[kind] || { total: 0, count: 0 };
    byOrderKindTotals[kind].total = roundMoney(byOrderKindTotals[kind].total + total);
    byOrderKindTotals[kind].count += 1;
  });

  const byDepartment = Object.keys(byDepartmentTotals)
    .sort()
    .map((key) => ({ department: key, total: byDepartmentTotals[key].total, count: byDepartmentTotals[key].count }));
  const byOrderKind = Object.keys(byOrderKindTotals)
    .sort()
    .map((key) => ({ kind: key, total: byOrderKindTotals[key].total, count: byOrderKindTotals[key].count }));

  const lineItems = visibleEvents.map((event) => {
    const src = getSource(event);
    const order = orderById[String(src.orderId || '')] || null;
    return {
      chargeEventId: event.id,
      status: event.status === 'VOID' ? 'VOIDED' : 'ACTIVE',
      code: event.code,
      name: event.name,
      department: event.departmentKey,
      unitType: event.unitType,
      qty: event.quantity,
      unitPrice: event.unitPrice,
      total: event.totalPrice,
      createdAt: event.createdAt,
      origin: {
        orderId: src.orderId || null,
        orderCode: order?.orderCode || null,
        kind: order?.kind || null,
      },
    };
  });

  const patient = encounter.patientId
    ? await prisma.patientMaster.findFirst({ where: { tenantId, id: encounter.patientId } })
    : null;

  const claimNumber = `CLM-${tenantId}-${String(encounterCoreId).slice(0, 8)}-${formatDateStamp(new Date())}`;

  return NextResponse.json({
    claimNumber,
    encounterCoreId,
    patient: patient
      ? {
          id: patient.id,
          name: [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Unknown',
          identifiers: patient.identifiers || null,
          dob: patient.dob || null,
          gender: patient.gender || null,
        }
      : null,
    provider: {
      department: encounter.department || 'UNKNOWN',
      encounterType: encounter.encounterType || 'UNKNOWN',
    },
    totals: {
      grandTotalActive: roundMoney(grandTotalActive),
      counts,
    },
    breakdown: { byDepartment, byOrderKind },
    lineItems,
    payerContext: payerContext || null,
    billingLock: lock || null,
    readiness,
    posting: posting || null,
    disclaimers: ['Draft – not submitted'],
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
