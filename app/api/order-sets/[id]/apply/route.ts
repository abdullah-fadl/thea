import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { appendOrderEvent, auditOrder, normalizeDepartmentKey, ORDER_KIND_TO_DEPARTMENT } from '@/lib/orders/ordersHub';
import { createAuditLog } from '@/lib/utils/audit';
import { ensureResultsWriteAllowed } from '@/lib/core/guards/resultsGuard';
import { validateBody } from '@/lib/validation/helpers';
import { applyOrderSetSchema } from '@/lib/validation/orders.schema';
import { Prisma } from '@prisma/client';
import type { OrderSet, OrderSetItem, IpdEpisode, EncounterCore, BillingChargeCatalog } from '@prisma/client';

/** Parsed shape of the `defaults` JSON column on OrderSetItem */
interface OrderSetItemDefaults {
  departmentKey?: string;
  priority?: string;
  clinicalText?: string | null;
  meta?: any | null;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ENCOUNTER_TYPES = new Set(['ER', 'OPD', 'IPD']);
const ALLOWED_ROLES = new Set(['doctor', 'charge']);

function roleKey(role: string, user: { role?: string } | null, _tenantId: string) {
  const roleLower = String(role || user?.role || '').toLowerCase();
  if (roleLower.includes('charge')) return 'charge';
  if (roleLower.includes('doctor') || roleLower.includes('physician')) return 'doctor';
  return roleLower;
}

function mapKind(kind: string) {
  const normalized = String(kind || '').toUpperCase();
  if (normalized === 'RADIOLOGY') return 'RADIOLOGY';
  if (normalized === 'PROCEDURE') return 'PROCEDURE';
  if (normalized === 'NON_MED') return 'PROCEDURE';
  return 'LAB';
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  const resolvedParams = params instanceof Promise ? await params : params;
  const id = String((resolvedParams as Record<string, string | string[]> | undefined)?.id || '').trim();
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, applyOrderSetSchema);
  if ('error' in v) return v.error;

  const missing: string[] = [];
  const encounterType = String(body.encounterType || '').trim().toUpperCase();
  const encounterId = String(body.encounterId || '').trim();
  if (!encounterType) missing.push('encounterType');
  if (!encounterId) missing.push('encounterId');
  if (missing.length) {
    return NextResponse.json({ error: 'Validation failed', missing }, { status: 400 });
  }
  if (!ENCOUNTER_TYPES.has(encounterType)) {
    return NextResponse.json({ error: 'Invalid encounterType' }, { status: 400 });
  }

  const orderSet = await prisma.orderSet.findFirst({
    where: { tenantId, id },
  });
  if (!orderSet) {
    return NextResponse.json({ error: 'Order set not found' }, { status: 404 });
  }
  const os = orderSet;
  if (os.status === 'ARCHIVED') {
    return NextResponse.json({ error: 'Order set archived' }, { status: 409 });
  }
  if (!(os.scope === 'GLOBAL' || os.scope === encounterType)) {
    return NextResponse.json({ error: 'Order set scope mismatch' }, { status: 409 });
  }

  const currentRole = roleKey(String(role || ''), user, tenantId);
  if (currentRole !== 'dev') {
    if (!ALLOWED_ROLES.has(currentRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (Array.isArray(os.roleScope) && os.roleScope.length) {
      if (!os.roleScope.includes(currentRole)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
  }

  let encounterCoreId = encounterId;
  let encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounter && encounterType === 'IPD') {
    const episode = await prisma.ipdEpisode.findFirst({
      where: { tenantId, id: encounterId },
    });
    if (episode?.encounterId) {
      encounterCoreId = String(episode.encounterId || '');
      encounter = await prisma.encounterCore.findFirst({
        where: { tenantId, id: encounterCoreId },
      });
    }
  }
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  const guard = await ensureResultsWriteAllowed({ tenantId, encounterCoreId });
  if (guard) return guard;

  const items = await prisma.orderSetItem.findMany({
    where: { tenantId, orderSetId: id },
    orderBy: { position: 'asc' },
  });
  if (!items.length) {
    return NextResponse.json({ error: 'Order set has no items' }, { status: 409 });
  }

  const encounterRefKey = `${encounterType}:${encounterId}`;
  const existing = await prisma.orderSetApplication.findFirst({
    where: { tenantId, orderSetId: id, encounterRefKey },
  });
  if (existing) {
    return NextResponse.json({ success: true, noOp: true, application: existing });
  }

  const createdOrderIds: string[] = [];
  const now = new Date();

  for (const item of items) {
    const orderKind = mapKind(item.kind || '');
    const itemDefaults = (item.defaults && typeof item.defaults === 'object') ? item.defaults as unknown as OrderSetItemDefaults : null;
    const departmentKey =
      normalizeDepartmentKey(itemDefaults?.departmentKey) ||
      ORDER_KIND_TO_DEPARTMENT[orderKind as keyof typeof ORDER_KIND_TO_DEPARTMENT] ||
      null;
    if (!departmentKey) {
      continue;
    }

    let procedureCharge: BillingChargeCatalog | null = null;
    if (orderKind === 'PROCEDURE') {
      procedureCharge = await prisma.billingChargeCatalog.findFirst({
        where: { tenantId, code: String(item.orderCode || ''), itemType: 'PROCEDURE' },
      });
      if (!procedureCharge) {
        return NextResponse.json(
          { error: 'Procedure charge not found', code: 'PROCEDURE_CODE_REQUIRED', orderCode: item.orderCode },
          { status: 400 }
        );
      }
    }

    const idempotencyKey = `order-set:${id}:${encounterRefKey}:${item.position}:${item.orderCode}`;
    const existingOrder = await prisma.ordersHub.findFirst({
      where: { tenantId, idempotencyKey },
    });
    if (existingOrder) {
      createdOrderIds.push(existingOrder.id);
      continue;
    }

    const order = await prisma.ordersHub.create({
      data: {
        tenantId,
        encounterCoreId,
        patientMasterId: encounter.patientId,
        sourceSystem: encounterType,
        sourceEncounterId: encounterCoreId,
        kind: orderKind,
        departmentKey,
        orderCode: String(item.orderCode || ''),
        orderName: String(item.displayName || ''),
        priority: String(itemDefaults?.priority || 'ROUTINE').toUpperCase(),
        clinicalText:
          item.kind === 'NON_MED'
            ? `NON_MED: ${item.displayName || item.orderCode || ''}`
            : itemDefaults?.clinicalText || null,
        status: 'ORDERED',
        cancelReason: null,
        orderedAt: now,
        acceptedAt: null,
        inProgressAt: null,
        resultedAt: null,
        completedAt: null,
        cancelledAt: null,
        assignedToUserId: null,
        meta:
          itemDefaults?.meta && typeof itemDefaults.meta === 'object'
            ? ({
                ...itemDefaults.meta,
                ...(procedureCharge
                  ? { procedureChargeId: procedureCharge.id, procedureChargeCode: procedureCharge.code }
                  : {}),
              } as Prisma.InputJsonValue)
            : procedureCharge
            ? ({ procedureChargeId: procedureCharge.id, procedureChargeCode: procedureCharge.code } as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        idempotencyKey,
        version: 1,
        createdAt: now,
        updatedAt: now,
        createdByUserId: userId || null,
      },
    });

    await appendOrderEvent({
      tenantId,
      orderId: order.id,
      encounterCoreId,
      type: 'PLACE',
      time: now,
      actorUserId: userId || null,
      actorDisplay: user?.email || null,
      payload: { kind: order.kind, departmentKey },
    });
    await auditOrder({
      tenantId,
      orderId: order.id,
      action: 'PLACE',
      userId: userId || null,
      userEmail: user?.email || null,
      changes: { after: order },
    });

    createdOrderIds.push(order.id);
  }

  const application = await prisma.orderSetApplication.create({
    data: {
      tenantId,
      orderSetId: id,
      encounterRef: { type: encounterType, id: encounterId } as Prisma.InputJsonValue,
      encounterRefKey,
      createdOrderIds,
      appliedByUserId: userId || null,
      appliedAt: now,
    },
  });

  await createAuditLog(
    'order_set',
    id,
    'APPLY',
    userId || 'system',
    user?.email,
    { after: { orderSetId: id, encounterRef: { type: encounterType, id: encounterId }, createdOrderIds } },
    tenantId
  );

  return NextResponse.json({ success: true, application });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'order.sets.view' }
);
