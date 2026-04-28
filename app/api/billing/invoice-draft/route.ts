import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { validateBody } from '@/lib/validation/helpers';
import { createInvoiceDraftSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { createAuditLog } from '@/lib/utils/audit';

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

function buildInvoiceNumber(tenantId: string, encounterCoreId: string) {
  const dateStamp = formatDateStamp(new Date());
  const hash = createHash('sha256').update(`${tenantId}:${encounterCoreId}`).digest('hex').slice(0, 8);
  return `DRAFT-${dateStamp}-${hash}`;
}

function buildDraftNumber(tenantId: string, patientId: string) {
  const dateStamp = formatDateStamp(new Date());
  // Use UUID-based suffix to guarantee uniqueness and avoid race conditions
  const uniqueSuffix = uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase();
  return `INV-${dateStamp}-${uniqueSuffix}`;
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

  const chargeEvents = await prisma.billingChargeEvent.findMany({
    where: { tenantId, encounterCoreId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 200,
  });

  const counts = {
    active: chargeEvents.filter((item: any) => item.status === 'ACTIVE').length,
    voided: chargeEvents.filter((item: any) => item.status === 'VOID').length,
    total: chargeEvents.length,
  };

  const activeEvents = chargeEvents.filter((item: any) => item.status === 'ACTIVE');
  const visibleEvents = includeVoided ? chargeEvents : activeEvents;

  const catalogIds = Array.from(new Set(visibleEvents.map((item: any) => String(item.chargeCatalogId || '')).filter(Boolean)));
  const catalogs = catalogIds.length
    ? await prisma.billingChargeCatalog.findMany({
        where: { tenantId, id: { in: catalogIds } },
      })
    : [];
  const catalogById = catalogs.reduce<any>((acc, catalog) => {
    acc[String(catalog.id || '')] = catalog;
    return acc;
  }, {});

  const orderIds = Array.from(
    new Set(
      visibleEvents
        .filter((item: any) => {
          const src = item.source as Record<string, unknown>;
          return String(src?.type || '') === 'ORDER';
        })
        .map((item: any) => {
          const src = item.source as Record<string, unknown>;
          return String(src?.orderId || '');
        })
        .filter(Boolean)
    )
  );
  const orders = orderIds.length
    ? await prisma.ordersHub.findMany({
        where: { tenantId, id: { in: orderIds } },
        select: { id: true, orderCode: true, kind: true },
      })
    : [];
  const orderById = orders.reduce<any>((acc, order) => {
    acc[String(order.id || '')] = order;
    return acc;
  }, {});

  let grandTotalActive = 0;
  const byDepartmentTotals: Record<string, { total: number; count: number }> = {};
  const byOrderKindTotals: Record<string, { total: number; count: number }> = {};

  activeEvents.forEach((item: any) => {
    const total = Number(item.totalPrice || 0);
    grandTotalActive += total;
    const dept = String(item.departmentKey || 'OTHER');
    byDepartmentTotals[dept] = byDepartmentTotals[dept] || { total: 0, count: 0 };
    byDepartmentTotals[dept].total = roundMoney(byDepartmentTotals[dept].total + total);
    byDepartmentTotals[dept].count += 1;

    let kind = 'MANUAL';
    const src = item.source as Record<string, unknown>;
    if (String(src?.type || '') === 'ORDER') {
      const order = orderById[String(src?.orderId || '')];
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

  const lineItems = visibleEvents.map((event: any) => {
    const catalog = catalogById[String(event.chargeCatalogId || '')] || null;
    const src = event.source as Record<string, unknown>;
    const order = orderById[String(src?.orderId || '')] || null;
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
      payerEligibility: {
        cashAllowed: Boolean(catalog?.allowedForCash),
        insuranceAllowed: Boolean(catalog?.allowedForInsurance),
      },
      createdAt: event.createdAt,
      createdBy: event.createdBy || null,
      voidedAt: event.voidedAt || null,
      voidedBy: event.voidedBy || null,
      voidReason: event.reason || null,
      origin: {
        orderId: src?.orderId || null,
        orderCode: order?.orderCode || null,
        kind: order?.kind || null,
      },
    };
  });

  const payerContext = await prisma.billingPayerContext.findFirst({
    where: { tenantId, encounterCoreId },
  });
  const billingLock = await prisma.billingLock.findFirst({
    where: { tenantId, encounterCoreId },
  });

  const activeCharges = counts.active;
  const voidedCharges = counts.voided;
  const payerExists = Boolean(payerContext);
  let encounterStatusOk = true;
  if (String(encounter.encounterType || '') === 'OPD') {
    const opd = await prisma.opdEncounter.findFirst({
      where: { tenantId, encounterCoreId },
      select: { status: true },
    });
    encounterStatusOk = String(encounter.status || '') === 'CLOSED' || String(opd?.status || '') === 'COMPLETED';
  }
  const reasons: string[] = [];
  if (!activeCharges) reasons.push('NO_ACTIVE_CHARGES');
  if (!payerExists) reasons.push('NO_PAYER_CONTEXT');
  if (!encounterStatusOk) reasons.push('ENCOUNTER_NOT_READY');

  const createdAtRange = {
    start: chargeEvents.length ? chargeEvents[0]?.createdAt || null : null,
    end: chargeEvents.length ? chargeEvents[chargeEvents.length - 1]?.createdAt || null : null,
  };

  return NextResponse.json({
    invoiceNumber: buildInvoiceNumber(String(tenantId || ''), encounterCoreId),
    encounterCoreId,
    patientMasterId: encounter.patientId || null,
    createdAtRange,
    totals: {
      grandTotalActive: roundMoney(grandTotalActive),
      counts,
    },
    breakdown: {
      byDepartment,
      byOrderKind,
    },
    lineItems,
    payerContext: payerContext || null,
    billingLock: billingLock || null,
    readiness: {
      ready: reasons.length === 0,
      reasons,
      metrics: {
        activeCharges,
        voidedCharges,
      },
    },
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.invoice.view' }
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

  const v = validateBody(body, createInvoiceDraftSchema);
  if ('error' in v) return v.error;

  const patientId = String(v.data.patientId || '').trim();

  const now = new Date();
  const invoiceId = `inv_${uuidv4()}`;
  const invoiceNumber = buildDraftNumber(String(tenantId || ''), patientId);
  const record = {
    id: uuidv4(),
    tenantId,
    invoiceNumber,
    encounterCoreId: body.encounterId || body.visitId || uuidv4(),
    patientMasterId: patientId || null,
    items: Array.isArray(body.items) ? body.items : [],
    subtotal: Math.max(0, Number(body.subtotal || 0)),
    discount: Math.max(0, Number(body.insuranceDiscount || 0)),
    tax: 0,
    total: Math.max(0, Number(body.total || 0)),
    status: 'DRAFT',
    promoCode: body.promoCode || null,
    promoDiscount: Math.max(0, Number(body.promoDiscount || 0)),
    metadata: {
      insuranceApprovalNumber: body.insuranceApprovalNumber || null,
      insuranceAmount: Math.max(0, Number(body.insuranceAmount || 0)),
    },
    createdAt: now,
    createdBy: userId || null,
  };

  await prisma.billingInvoice.create({ data: record });

  await createAuditLog(
    'billing_invoice', record.id, 'INVOICE_DRAFT_CREATED',
    userId || 'system', user?.email,
    { encounterId: record.encounterCoreId, patientId: record.patientMasterId },
    tenantId
  );

  return NextResponse.json({ invoiceId: record.id, invoiceNumber });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.invoice.view' }
);
