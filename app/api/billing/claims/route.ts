import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import type { BillingClaimEvent, BillingChargeEvent } from '@prisma/client';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';
import { createClaimSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ClaimStatus = 'DRAFT' | 'SUBMITTED' | 'REJECTED' | 'RESUBMITTED' | 'PAID';

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function formatDateStamp(date: Date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

async function getLatestClaimEvents(tenantId: string, claimIds: string[]) {
  if (!claimIds.length) return {};
  const events = await prisma.billingClaimEvent.findMany({
    where: { tenantId, claimId: { in: claimIds } },
    orderBy: [{ createdAt: 'desc' }],
  });
  return events.reduce((acc: Record<string, BillingClaimEvent>, event) => {
    const id = String(event.claimId || '');
    if (!acc[id]) acc[id] = event;
    return acc;
  }, {} as Record<string, BillingClaimEvent>);
}

async function buildClaimDraft(tenantId: string, encounterCoreId: string) {
  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounter) {
    return { error: 'Encounter not found' as const };
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

  type ChargeSource = { type?: string; orderId?: string };
  const getSource = (item: BillingChargeEvent): ChargeSource =>
    (item.source && typeof item.source === 'object' && !Array.isArray(item.source) ? item.source : {}) as ChargeSource;

  const orderIds = Array.from(
    new Set(
      activeEvents
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
  const orderById = orders.reduce((acc: Record<string, { id: string; orderCode: string | null; kind: string }>, order) => {
    acc[String(order.id || '')] = order;
    return acc;
  }, {} as Record<string, { id: string; orderCode: string | null; kind: string }>);

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

    const src = getSource(item);
    let kind = 'MANUAL';
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

  const lineItems = activeEvents.map((event) => {
    const src = getSource(event);
    const order = orderById[String(src.orderId || '')] || null;
    return {
      chargeEventId: event.id,
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

  return {
    encounter,
    claimNumber,
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
  };
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const claims = await prisma.billingClaim.findMany({
    where: { tenantId },
    orderBy: [{ createdAt: 'desc' }],
    take: 200,
  });
  const claimIds = claims.map((c) => String(c.id || '')).filter(Boolean);
  const latestEvents = await getLatestClaimEvents(tenantId, claimIds);

  const items = claims.map((claim) => {
    const latest = latestEvents[String(claim.id || '')] || null;
    const status = (latest?.status || 'DRAFT') as ClaimStatus;
    const version = Number(latest?.version || 1);
    return {
      id: claim.id,
      claimNumber: claim.claimNumber,
      encounterCoreId: claim.encounterCoreId,
      patientName: (claim.patient && typeof claim.patient === 'object' && !Array.isArray(claim.patient) && 'name' in claim.patient ? String(claim.patient.name) : null) || 'Unknown',
      totals: claim?.totals || null,
      status,
      version,
      createdAt: claim.createdAt,
    };
  });

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role, userId }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, createClaimSchema);
  if ('error' in v) return v.error;
  const encounterCoreId = String(v.data.encounterCoreId || '').trim();

  // Ensure billing is locked and posted before creating a claim
  const billingLock = await prisma.billingLock.findFirst({
    where: { tenantId, encounterCoreId },
  });
  if (!billingLock?.isLocked) {
    return NextResponse.json(
      { error: 'Billing must be locked before creating a claim' },
      { status: 409 }
    );
  }
  const billingPosting = await prisma.billingPosting.findFirst({
    where: { tenantId, encounterCoreId },
  });
  if (billingPosting?.status !== 'POSTED') {
    return NextResponse.json(
      { error: 'Billing must be posted before creating a claim' },
      { status: 409 }
    );
  }

  const existing = await prisma.billingClaim.findFirst({
    where: { tenantId, encounterCoreId },
  });
  if (existing) {
    return NextResponse.json({ success: true, noOp: true, claimId: existing.id });
  }

  const draft = await buildClaimDraft(tenantId, encounterCoreId);
  if ('error' in draft) {
    return NextResponse.json({ error: draft.error }, { status: 404 });
  }

  const now = new Date();
  const claimId = uuidv4();
  const claim = {
    id: claimId,
    tenantId,
    encounterCoreId,
    claimNumber: draft.claimNumber,
    patient: draft.patient ?? undefined,
    provider: draft.provider,
    totals: draft.totals,
    breakdown: draft.breakdown,
    lineItems: draft.lineItems,
    payerContext: draft.payerContext ?? undefined,
    readiness: draft.readiness,
    createdAt: now,
    createdByUserId: userId || null,
  };

  const draftEvent = {
    id: uuidv4(),
    tenantId,
    claimId,
    status: 'DRAFT' as ClaimStatus,
    version: 1,
    createdAt: now,
    createdByUserId: userId || null,
  };

  await prisma.billingClaim.create({ data: claim });
  await prisma.billingClaimEvent.create({ data: draftEvent });
  await createAuditLog(
    'claim_event',
    draftEvent.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: draftEvent },
    tenantId
  );

  return NextResponse.json({ success: true, claimId: claim.id });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);
