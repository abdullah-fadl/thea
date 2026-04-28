import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { createAuditLog } from '@/lib/utils/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  decision: z.string().optional(),
  reason: z.string().optional(),
}).passthrough();

function isPharmacy(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r.includes('pharmacy');
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }, params) => {

  const role = String((user as any)?.role || '');
  const dev = false;
  const charge = canAccessChargeConsole({ email: user?.email, tenantId, role });
  if (!dev && !charge && !isPharmacy(role)) {
    return NextResponse.json({ error: 'Forbidden: pharmacy only' }, { status: 403 });
  }

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

  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const decision = String(v.data.decision || 'DISPENSED').trim().toUpperCase();
  const reason = String(body.reason || '').trim();
  const missing: string[] = [];
  const invalid: string[] = [];
  if (!decision) missing.push('decision');
  if (decision && decision !== 'DISPENSED') invalid.push('decision');
  if (missing.length || invalid.length) {
    return NextResponse.json({ error: 'Validation failed', missing, invalid }, { status: 400 });
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

  const medication = (order as any)?.meta?.medication || {};
  if (!medication?.isNarcotic) {
    return NextResponse.json({ error: 'Dispense confirmation only for narcotics' }, { status: 409 });
  }

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

  const latestEvent = await prisma.ipdMedOrderEvent.findFirst({
    where: { tenantId, orderId },
    orderBy: { createdAt: 'desc' },
  });
  const currentStatus = String(latestEvent?.status || 'ORDERED');
  if (currentStatus === 'DISPENSED') {
    return NextResponse.json({ success: true, noOp: true, decision: 'DISPENSED' });
  }
  if (currentStatus !== 'ORDERED') {
    return NextResponse.json({ error: 'Invalid status for dispense', status: currentStatus }, { status: 409 });
  }

  const now = new Date();
  const event = await prisma.ipdMedOrderEvent.create({
    data: {
      tenantId,
      episodeId,
      orderId,
      status: 'DISPENSED',
      reason: reason || null,
      createdByUserId: userId,
      createdAt: now,
    },
  });
  await createAuditLog(
    'ipd_med_dispense',
    event.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: event },
    tenantId
  );

  return NextResponse.json({ success: true, decision: 'DISPENSED' });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
