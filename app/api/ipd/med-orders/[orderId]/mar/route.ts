import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { writeErAuditLog } from '@/lib/er/audit';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  action: z.enum(['ADMINISTERED', 'NOT_ADMINISTERED']),
  reason: z.string().optional(),
  scheduledFor: z.string().optional(),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }, params) => {

  const role = String(user?.role || '');
  const dev = false;
  const charge = canAccessChargeConsole({ email: user?.email, tenantId, role });

  const routeParams = (await params) || {};
  const orderId = String((routeParams as any).orderId || '').trim();
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
  if (action === 'NOT_ADMINISTERED' && !reason) {
    return NextResponse.json({ error: 'reason is required for NOT_ADMINISTERED' }, { status: 400 });
  }

  const order = await prisma.ordersHub.findFirst({
    where: { tenantId, id: orderId },
  });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const meta = order.meta as Record<string, unknown> | null;
  const medication = (meta?.medication || {}) as Record<string, unknown>;
  const episodeId = String(medication.episodeId || '');
  const episode = await prisma.ipdEpisode.findFirst({
    where: { tenantId, id: episodeId },
  });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }
  const ownership = episode.ownership as Record<string, unknown> | null;
  const primaryNurseId = String(ownership?.primaryInpatientNurseUserId || '').trim();
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
  const medStatus = String(latestEvent?.status || order.status || 'DRAFT');
  if (medStatus !== 'VERIFIED' && medStatus !== 'ACTIVE') {
    return NextResponse.json({ error: 'Order not verified', status: medStatus }, { status: 409 });
  }

  const now = new Date();
  const scheduledFor = body.scheduledFor ? new Date(body.scheduledFor as string) : now;
  if (Number.isNaN(scheduledFor.getTime())) {
    return NextResponse.json({ error: 'scheduledFor is invalid' }, { status: 400 });
  }
  const existing = await prisma.ipdMarEvent.findFirst({
    where: {
      tenantId,
      orderId,
      scheduledFor,
      status: action,
    },
  });
  if (existing) {
    return NextResponse.json({ success: true, noOp: true, action });
  }

  try {
    await prisma.ipdMarEvent.create({
      data: {
        tenantId,
        episodeId,
        orderId,
        scheduledFor,
        status: action,
        note: action === 'NOT_ADMINISTERED' ? reason : null,
        performedByUserId: userId,
        performedAt: now,
        createdAt: now,
      },
    });
  } catch (err: unknown) {
    const prismaErr = err as Record<string, unknown>;
    if (prismaErr?.code === 'P2002') {
      return NextResponse.json({ success: true, noOp: true, action });
    }
    throw err;
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'ipd_mar_event',
    entityId: orderId,
    action,
    after: { orderId, scheduledFor, action, reason: action === 'NOT_ADMINISTERED' ? reason : null },
    ip,
  });

  return NextResponse.json({ success: true, action });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
