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

const ACTIONS = ['GIVEN', 'HELD', 'MISSED'] as const;

const bodySchema = z.object({
  action: z.enum(['GIVEN', 'HELD', 'MISSED']),
  scheduledFor: z.string().min(1, 'scheduledFor is required'),
  reason: z.string().optional(),
  doseGiven: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as any);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }, params) => {

  const role = String((user as unknown as { role?: string })?.role || '');
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

  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const action = v.data.action;
  const reason = String(v.data.reason || '').trim();
  const doseGiven = String(v.data.doseGiven || '').trim();
  const notes = String(v.data.notes || '').trim();
  const scheduledFor = parseDate(v.data.scheduledFor);
  const missing: string[] = [];
  const invalid: string[] = [];
  if ((action === 'HELD' || action === 'MISSED') && !reason) missing.push('reason');
  if (action === 'GIVEN' && !doseGiven) missing.push('doseGiven');
  if (!scheduledFor) invalid.push('scheduledFor');
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

  const medication = ((order.meta as Record<string, unknown> | null)?.medication as Record<string, unknown>) || {};
  const episodeId = String(medication.episodeId || '');
  const episode = await prisma.ipdEpisode.findFirst({
    where: { tenantId, id: episodeId },
  });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }
  const encounterCoreId = String(episode.encounterId || '').trim();
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

  const primaryNurseId = String((episode.ownership as Record<string, unknown> | null)?.primaryInpatientNurseUserId || '').trim();
  if (!dev && !charge && primaryNurseId !== String(userId || '')) {
    return NextResponse.json(
      { error: 'Forbidden: only primary nurse or charge roles can perform MAR actions' },
      { status: 403 }
    );
  }

  const latestEvent = await prisma.ipdMedOrderEvent.findFirst({
    where: { tenantId, orderId },
    orderBy: { createdAt: 'desc' },
  });
  const medStatus = String(latestEvent?.status || 'ORDERED');
  const isNarcotic = Boolean(medication.isNarcotic);
  if (isNarcotic && medStatus !== 'DISPENSED') {
    return NextResponse.json({ error: 'Dispense required', status: medStatus }, { status: 409 });
  }
  if (!isNarcotic && medStatus !== 'ACTIVE') {
    return NextResponse.json({ error: 'Order not active', status: medStatus }, { status: 409 });
  }

  const type = String(medication.orderType || '').toUpperCase();
  if (type === 'PRN') {
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const max = Number(medication.maxPer24h || 0);
    const count = await prisma.ipdMarEvent.count({
      where: {
        tenantId,
        orderId,
        status: 'GIVEN',
        performedAt: { gte: since },
      },
    });
    if (max > 0 && count >= max) {
      return NextResponse.json({ error: 'PRN max per 24h exceeded' }, { status: 409 });
    }
  }

  const existing = await prisma.ipdMarEvent.findFirst({
    where: {
      tenantId,
      orderId,
      scheduledFor: scheduledFor!,
      status: action,
    },
  });
  if (existing) {
    return NextResponse.json({ success: true, noOp: true, action });
  }

  const now = new Date();
  try {
    await prisma.ipdMarEvent.create({
      data: {
        tenantId,
        episodeId,
        orderId,
        scheduledFor: scheduledFor!,
        status: action,
        dose: action === 'GIVEN' ? doseGiven : null,
        note: action === 'GIVEN' ? (notes || null) : (reason || notes || null),
        performedByUserId: userId,
        performedAt: now,
        createdAt: now,
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002') {
      return NextResponse.json({ success: true, noOp: true, action });
    }
    throw err;
  }

  await createAuditLog(
    'ipd_mar_event',
    orderId,
    action,
    userId || 'system',
    user?.email,
    { after: { orderId, scheduledFor, action } },
    tenantId
  );

  return NextResponse.json({ success: true, action });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
