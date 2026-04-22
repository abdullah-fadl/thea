import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { normalizeChargeDepartmentKey } from '@/lib/billing/chargeEvents';
import { canAccessBilling } from '@/lib/billing/access';
import { validateBody } from '@/lib/validation/helpers';
import { createChargeEventSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PAYER_TYPES = new Set(['CASH', 'INSURANCE', 'PENDING']);

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
  const where: any = { tenantId, encounterCoreId };
  if (!includeVoided) {
    where.status = 'ACTIVE';
  }

  const items = await prisma.billingChargeEvent.findMany({
    where,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 200,
  });

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, createChargeEventSchema);
  if ('error' in v) return v.error;

  const encounterCoreId = String(v.data.encounterCoreId || '').trim();
  const patientMasterId = v.data.patientMasterId ? String(v.data.patientMasterId || '').trim() : null;
  const departmentKey = normalizeChargeDepartmentKey(v.data.departmentKey);
  const sourceType = String(v.data.source?.type || '').trim().toUpperCase();
  const sourceOrderId = v.data.source?.orderId ? String(v.data.source.orderId || '').trim() : null;
  const sourceOrderItemId = v.data.source?.orderItemId ? String(v.data.source.orderItemId || '').trim() : null;
  const chargeCatalogId = String(v.data.chargeCatalogId || '').trim();
  const quantity = v.data.quantity;
  const payerType = String(v.data.payerType || 'PENDING').trim().toUpperCase();
  const reason = v.data.reason ? String(v.data.reason || '').trim() : null;
  const idempotencyKey = v.data.idempotencyKey ? String(v.data.idempotencyKey || '').trim() : null;

  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  if (String(encounter.status || '') === 'CLOSED') {
    return NextResponse.json({ error: 'Encounter is closed' }, { status: 409 });
  }

  // Check billing lock
  const billingLock = await prisma.billingLock.findFirst({
    where: { tenantId, encounterCoreId },
  });
  if (billingLock?.isLocked) {
    return NextResponse.json({ error: 'Billing is locked for this encounter' }, { status: 409 });
  }

  // Check posting status
  const billingPosting = await prisma.billingPosting.findFirst({
    where: { tenantId, encounterCoreId },
  });
  if (billingPosting?.status === 'POSTED') {
    return NextResponse.json({ error: 'Billing is posted — cannot add charges', code: 'BILLING_POSTED' }, { status: 409 });
  }

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
  if (deathGuard) return deathGuard;

  const catalog = await prisma.billingChargeCatalog.findFirst({
    where: { tenantId, id: chargeCatalogId },
  });
  if (!catalog) {
    return NextResponse.json({ error: 'Charge catalog item not found' }, { status: 404 });
  }
  if (String(catalog.status || '') !== 'ACTIVE') {
    return NextResponse.json({ error: 'Charge catalog item is inactive' }, { status: 409 });
  }

  // [B-01] Guard: zero/negative charge validation
  const computedUnitPrice = Number(catalog.basePrice || 0);
  if (computedUnitPrice < 0) {
    return NextResponse.json({ error: 'Catalog base price is negative', code: 'INVALID_PRICE' }, { status: 400 });
  }
  const computedTotal = Number((Number(quantity) * computedUnitPrice).toFixed(2));
  if (computedTotal <= 0 && sourceType === 'MANUAL') {
    return NextResponse.json(
      { error: 'Cannot create a zero-amount manual charge', code: 'ZERO_CHARGE' },
      { status: 400 }
    );
  }
  if (computedTotal > 999999) {
    return NextResponse.json(
      { error: 'Computed charge total exceeds ceiling (999,999)', code: 'TOTAL_EXCEEDS_CEILING' },
      { status: 400 }
    );
  }

  // [B-02] Guard: pre-auth enforcement for PROCEDURE charges
  const catalogItemType = String(catalog?.itemType || '').toUpperCase();
  if (catalogItemType === 'PROCEDURE' && payerType === 'INSURANCE') {
    const payerCtx = await prisma.billingPayerContext.findFirst({
      where: { tenantId, encounterCoreId },
    });
    if (payerCtx?.mode === 'INSURANCE') {
      const approvedAuth = await prisma.nphiesPriorAuth.findFirst({
        where: {
          tenantId,
          encounterId: encounterCoreId,
          status: 'APPROVED',
          approved: true,
          expiryDate: { gte: new Date() },
        },
      });
      if (!approvedAuth && !body.overridePreauthCheck) {
        return NextResponse.json(
          {
            error: 'Pre-authorization is required for procedure charges under insurance',
            code: 'PREAUTH_REQUIRED',
          },
          { status: 422 }
        );
      }
    }
  }

  if (sourceType === 'ORDER') {
    const existing = await prisma.billingChargeEvent.findFirst({
      where: {
        tenantId,
        status: 'ACTIVE',
        source: { path: ['type'], equals: 'ORDER' },
        chargeCatalogId,
      },
    });
    // Additional filter on orderId/orderItemId via JS since JSON path queries are limited
    if (existing) {
      const src = existing.source as Record<string, unknown>;
      if (src?.orderId === sourceOrderId && src?.orderItemId === sourceOrderItemId) {
        return NextResponse.json({ chargeEvent: existing, noOp: true });
      }
    }
    // More thorough search: find all matching and filter
    const candidates = await prisma.billingChargeEvent.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        chargeCatalogId,
      },
      take: 100,
    });
    const match = candidates.find((c: any) => {
      const s = c.source as Record<string, unknown>;
      return s?.type === 'ORDER' && s?.orderId === sourceOrderId && s?.orderItemId === sourceOrderItemId;
    });
    if (match) {
      return NextResponse.json({ chargeEvent: match, noOp: true });
    }
  }

  if (sourceType === 'MANUAL' && idempotencyKey) {
    const existing = await prisma.billingChargeEvent.findFirst({
      where: { tenantId, idempotencyKey },
    });
    if (existing) {
      return NextResponse.json({ chargeEvent: existing, noOp: true });
    }
  }

  const now = new Date();
  const unitPrice = Number(catalog.basePrice || 0);
  const totalPrice = Number((Number(quantity) * unitPrice).toFixed(2));
  const chargeEvent = {
    id: uuidv4(),
    tenantId,
    encounterCoreId,
    patientMasterId: patientMasterId || encounter.patientId || null,
    departmentKey,
    source: {
      type: sourceType,
      orderId: sourceOrderId,
      orderItemId: sourceOrderItemId,
    },
    chargeCatalogId,
    code: catalog.code,
    name: catalog.name,
    unitType: catalog.unitType,
    quantity: Number(quantity),
    unitPrice,
    totalPrice,
    payerType,
    status: 'ACTIVE',
    reason: reason || null,
    createdAt: now,
    createdBy: userId || null,
    idempotencyKey: idempotencyKey || null,
  };

  try {
    await prisma.billingChargeEvent.create({ data: chargeEvent });
  } catch (err: any) {
    // Handle unique constraint violation (Prisma P2002)
    if (err?.code === 'P2002') {
      if (sourceType === 'MANUAL' && idempotencyKey) {
        const fallback = await prisma.billingChargeEvent.findFirst({
          where: { tenantId, idempotencyKey },
        });
        if (fallback) return NextResponse.json({ chargeEvent: fallback, noOp: true });
      }
      if (sourceType === 'ORDER') {
        const candidates = await prisma.billingChargeEvent.findMany({
          where: {
            tenantId,
            status: 'ACTIVE',
            chargeCatalogId,
          },
          take: 100,
        });
        const fallback = candidates.find((c: any) => {
          const s = c.source as Record<string, unknown>;
          return s?.type === 'ORDER' && s?.orderId === sourceOrderId && s?.orderItemId === sourceOrderItemId;
        });
        if (fallback) return NextResponse.json({ chargeEvent: fallback, noOp: true });
      }
    }
    throw err;
  }

  await createAuditLog(
    'charge_event',
    chargeEvent.id,
    'CREATE_CHARGE_EVENT',
    userId || 'system',
    user?.email,
    {
      encounterCoreId: chargeEvent.encounterCoreId,
      patientMasterId: chargeEvent.patientMasterId,
      departmentKey: chargeEvent.departmentKey,
      source: chargeEvent.source,
      chargeCatalogId: chargeEvent.chargeCatalogId,
      totals: { quantity: chargeEvent.quantity, unitPrice: chargeEvent.unitPrice, totalPrice: chargeEvent.totalPrice },
      reason: chargeEvent.reason,
    },
    tenantId
  );

  return NextResponse.json({ chargeEvent });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);
