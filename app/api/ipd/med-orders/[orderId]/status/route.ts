import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';
import { updateMedOrderStatusSchema } from '@/lib/validation/ipd.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATUS = ['ORDERED', 'ACTIVE', 'DISPENSED', 'DISCONTINUED'] as const;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }, params) => {

  const role = String((user as unknown as Record<string, unknown>)?.role || '');
  const dev = false;
  const charge = canAccessChargeConsole({ email: user?.email, tenantId, role });

  const routeParams = params || {};
  const orderId = String((routeParams as Record<string, string>).orderId || '').trim();
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, updateMedOrderStatusSchema);
  if ('error' in v) return v.error;
  const nextStatus = v.data.status;
  const reason = v.data.reason || '';
  if (nextStatus === 'DISCONTINUED' && !reason) {
    return NextResponse.json({ error: 'Validation failed', missing: ['reason'], invalid: [] }, { status: 400 });
  }

  const order = await prisma.ordersHub.findFirst({
    where: { tenantId, id: orderId },
  });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (String(order.kind || '') !== 'MEDICATION') {
    return NextResponse.json({ error: 'Not a medication order' }, { status: 409 });
  }

  const medication = ((order as Record<string, unknown>)?.meta as any)?.medication || {};
  const episodeId = String(medication.episodeId || '');
  const episode = await prisma.ipdEpisode.findFirst({
    where: { tenantId, id: episodeId },
  });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }
  const encounterCoreId = String(order.encounterCoreId || '').trim();
  if (encounterCoreId) {
    const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
    if (deathGuard) return deathGuard;
  }
  const discharge = await prisma.dischargeSummary.findFirst({
    where: { tenantId, encounterCoreId },
  });
  if (discharge) {
    return NextResponse.json({ error: 'Discharge finalized' }, { status: 409 });
  }
  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  if (String(encounter.status || '').toUpperCase() === 'CLOSED') {
    return NextResponse.json({ error: 'Encounter is closed' }, { status: 409 });
  }
  const attendingId = String(((episode as Record<string, unknown>)?.ownership as any)?.attendingPhysicianUserId || '').trim();
  if (!dev && !charge && attendingId !== String(userId || '')) {
    return NextResponse.json(
      { error: 'Forbidden: only attending physician or charge roles can update status' },
      { status: 403 }
    );
  }

  const latestEvent = await prisma.ipdMedOrderEvent.findFirst({
    where: { tenantId, orderId },
    orderBy: { createdAt: 'desc' },
  });
  const currentStatus = String(latestEvent?.status || 'ORDERED');
  if (currentStatus === nextStatus) {
    return NextResponse.json({ success: true, noOp: true, status: currentStatus });
  }

  const allowed =
    (currentStatus === 'ORDERED' && nextStatus === 'DISCONTINUED') ||
    (currentStatus === 'ACTIVE' && nextStatus === 'DISCONTINUED') ||
    (currentStatus === 'DISPENSED' && nextStatus === 'DISCONTINUED');
  if (!allowed) {
    return NextResponse.json({ error: 'Invalid transition', missing: [], invalid: ['status'] }, { status: 400 });
  }

  const now = new Date();
  try {
    await prisma.ipdMedOrderEvent.create({
      data: {
        tenantId,
        episodeId,
        orderId,
        status: nextStatus,
        reason: reason || null,
        createdByUserId: userId,
        createdAt: now,
      },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const latest = await prisma.ipdMedOrderEvent.findFirst({
        where: { tenantId, orderId },
        orderBy: { createdAt: 'desc' },
      });
      const latestStatus = String(latest?.status || '');
      if (latestStatus === nextStatus) {
        return NextResponse.json({ success: true, noOp: true, status: latestStatus });
      }
    }
    throw err;
  }

  await createAuditLog(
    'ipd_med_order',
    orderId,
    'SET_STATUS',
    userId || 'system',
    user?.email,
    { before: { status: currentStatus }, after: { status: nextStatus, reason: reason || null } },
    tenantId
  );

  return NextResponse.json({ success: true, status: nextStatus });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
