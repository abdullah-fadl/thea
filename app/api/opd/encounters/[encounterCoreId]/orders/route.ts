import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

import { createAuditLog } from '@/lib/utils/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { validateBody } from '@/lib/validation/helpers';
import { opdOrderSchema, opdOrdersBulkSchema } from '@/lib/validation/opd.schema';
import { emit } from '@/lib/events';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Map orders_hub status to OPD-compatible status.
 * orders_hub uses: ORDERED, PLACED, ACCEPTED, IN_PROGRESS, RESULT_READY, COMPLETED, CANCELLED
 * OPD frontend expects: ORDERED, IN_PROGRESS, COMPLETED, CANCELLED
 */
function mapHubStatus(hubStatus: string): string {
  switch (hubStatus) {
    case 'PLACED':
    case 'ORDERED':
    case 'ACCEPTED':
      return 'ORDERED';
    case 'IN_PROGRESS':
    case 'RESULT_READY':
      return 'IN_PROGRESS';
    case 'COMPLETED':
      return 'COMPLETED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return hubStatus || 'ORDERED';
  }
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const encounterCoreId = String((params as Record<string, string> | undefined)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
  if (deathGuard) return deathGuard;

  // ── Encounter payment (for all orders in this visit) ──
  const opdEncounter = await prisma.opdEncounter.findUnique({
    where: { tenantId, encounterCoreId },
    select: { paymentStatus: true, paymentPaidAt: true },
  });
  const paymentStatus = opdEncounter?.paymentStatus ?? null;
  const paidAt = opdEncounter?.paymentPaidAt ?? null;

  // ── Read from orders_hub (primary) ──
  const hubOrders = await prisma.ordersHub.findMany({
    where: { tenantId, encounterCoreId, sourceSystem: 'OPD' },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const hubOrderIds = hubOrders.map((o) => o.id);
  const ordersWithResults =
    hubOrderIds.length > 0
      ? await prisma.orderResult.findMany({
          where: { tenantId, orderId: { in: hubOrderIds } },
          select: { orderId: true },
        })
      : [];
  const orderIdsWithResults = new Set(ordersWithResults.map((r) => r.orderId));

  // Collect opdOrderIds that are already synced to orders_hub
  const syncedOpdIds = new Set<string>();
  for (const ho of hubOrders) {
    const opdId = (ho.meta as Record<string, any> | null)?.opdOrderId;
    if (opdId) syncedOpdIds.add(opdId);
  }

  // ── Fallback: include legacy opd_orders not yet synced ──
  const legacyOrders = await prisma.opdOrder.findMany({
    where: {
      tenantId,
      encounterCoreId,
      id: { notIn: [...syncedOpdIds] },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  // ── Map orders_hub → frontend-compatible shape ──
  const hubItems = hubOrders.map((o) => {
    const meta = (o.meta || {}) as Record<string, any>;
    const orderPayment = meta.payment || {};
    const orderPaymentStatus = orderPayment.status || null;
    return {
      id: meta.opdOrderId || o.id,
      hubId: o.id,
      kind: o.kind || null,
      title: o.orderName || null,
      name: o.orderName || null,
      status: mapHubStatus(o.status),
      notes: o.notes || null,
      orderedAt: o.orderedAt || o.createdAt,
      createdAt: o.createdAt,
      priority: o.priority || null,
      source: 'orders_hub' as const,
      hasResult: orderIdsWithResults.has(o.id),
      paymentStatus: orderPaymentStatus,
      paidAt: orderPayment.paidAt || null,
    };
  });

  // ── Map legacy opd_orders → same shape ──
  const legacyItems = legacyOrders.map((o) => ({
    id: o.id,
    hubId: null,
    kind: o.kind || null,
    title: o.title || null,
    name: o.title || null,
    status: o.status,
    notes: o.notes || null,
    orderedAt: o.orderedAt || o.createdAt,
    createdAt: o.createdAt,
    priority: o.priority || null,
    source: 'opd_orders' as const,
    hasResult: false,
    paymentStatus: null,
    paidAt: null,
  }));

  // ── Merge and sort by createdAt desc ──
  const items = [...hubItems, ...legacyItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json({ items, paymentStatus, paidAt });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.doctor.encounter.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const encounterCoreId = String((params as Record<string, string> | undefined)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Support both single { kind, title, ... } and bulk { orders: [...] }
  const isBulk = Array.isArray(body.orders) && body.orders.length > 0;
  const v = isBulk
    ? validateBody(body, opdOrdersBulkSchema)
    : validateBody(body, opdOrderSchema);
  if ('error' in v) return v.error;
  const ordersToCreate: Array<{ kind: string; title: string; catalogItemId?: string; catalogCode?: string; price?: number; notes?: string; dueWithinDays?: number }> = isBulk
    ? (v.data as Record<string, unknown>).orders as Array<{ kind: string; title: string; catalogItemId?: string; catalogCode?: string; price?: number; notes?: string; dueWithinDays?: number }>
    : [v.data as { kind: string; title: string; catalogItemId?: string; catalogCode?: string; price?: number; notes?: string; dueWithinDays?: number }];

  const encounterCore = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounterCore) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  if (encounterCore.encounterType !== 'OPD') {
    return NextResponse.json({ error: 'Encounter is not OPD' }, { status: 409 });
  }
  if (encounterCore.status === 'CLOSED') {
    return NextResponse.json({ error: 'Encounter is closed' }, { status: 409 });
  }

  const now = new Date();
  const created: Array<Awaited<ReturnType<typeof prisma.opdOrder.create>>> = [];
  for (const o of ordersToCreate) {
    const { kind, title, catalogItemId, catalogCode, price, notes, dueWithinDays } = o;
    const dueAt = dueWithinDays
      ? new Date(now.getTime() + dueWithinDays * 24 * 60 * 60 * 1000)
      : null;
    const order = await prisma.opdOrder.create({
      data: {
        tenantId,
        encounterCoreId,
        patientId: encounterCore.patientId,
        kind,
        title,
        notes: notes || null,
        orderDetails: catalogItemId
          ? { catalogItemId, ...(dueWithinDays ? { dueWithinDays } : {}) }
          : dueWithinDays ? { dueWithinDays } : null,
        status: 'ORDERED',
        orderedAt: now,
        createdByUserId: userId,
      },
    });
    created.push(order);

    // ── Sync to orders_hub so Lab/Rad worklist can see this order ──
    try {
      const KIND_TO_DEPT: Record<string, string> = {
        LAB: 'laboratory',
        RADIOLOGY: 'radiology',
        RAD: 'radiology',
        PHARMACY: 'pharmacy',
        PROCEDURE: 'operating-room',
        REFERRAL: 'referral',
        CONSULT: 'consultation',
      };

      await prisma.ordersHub.create({
        data: {
          tenantId,
          encounterCoreId,
          patientMasterId: encounterCore.patientId || undefined,
          sourceSystem: 'OPD',
          sourceEncounterId: encounterCoreId,
          sourceDepartment: 'opd',
          kind: kind,
          departmentKey: KIND_TO_DEPT[kind] || null,
          orderCode: catalogCode || catalogItemId || null,
          orderName: title,
          priority: 'ROUTINE',
          notes: notes || null,
          status: 'ORDERED',
          orderedAt: now,
          meta: {
            opdOrderId: order.id,
            catalogItemId: catalogItemId || null,
            catalogCode: catalogCode || null,
            ...(price ? { price, unitPrice: price, totalPrice: price } : {}),
            ...(dueWithinDays ? { dueWithinDays, dueAt: dueAt?.toISOString() } : {}),
          },
          createdByUserId: userId,
        },
      });
    } catch (syncErr) {
      // Log but don't fail — the OPD order was created successfully
      logger.error('[OPD→OrdersHub sync] Failed to sync order', { category: 'api', error: syncErr instanceof Error ? syncErr : undefined });
    }

    await createAuditLog(
      'opd_order',
      order.id,
      'CREATE',
      userId || 'system',
      user?.email,
      { after: order },
      tenantId
    );

    // Emit order.placed@v1 — best-effort, fires once per order in the loop.
    // Skipped silently if encounter has no patient or order kind is unknown.
    if (encounterCore.patientId) {
      try {
        await emit({
          eventName: 'order.placed',
          version: 1,
          tenantId,
          aggregate: 'order',
          aggregateId: order.id,
          payload: {
            orderId: order.id,
            encounterId: encounterCoreId,
            patientId: encounterCore.patientId,
            tenantId,
            kind,
            placedAt: now.toISOString(),
          },
        });
      } catch (e) {
        logger.error('events.emit_failed', { category: 'opd', eventName: 'order.placed', error: e });
      }
    }
  }

  return NextResponse.json({
    success: true,
    order: created[0],
    orders: created.length > 1 ? created : undefined,
  });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.doctor.orders.create' }
);
