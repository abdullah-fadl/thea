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

const ALLOWED = ['DRAFT', 'ORDERED', 'DONE', 'CANCELLED'] as const;

const bodySchema = z.object({
  status: z.enum(['DRAFT', 'ORDERED', 'DONE', 'CANCELLED']),
  cancelReason: z.string().optional(),
}).passthrough();

function isDoctor(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r.includes('doctor') || r.includes('physician');
}

function isNurse(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r.includes('nurse') || r.includes('nursing');
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }, params) => {

  const role = String((user as unknown as Record<string, unknown>)?.role || '');
  const dev = false;

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

  const nextStatus = v.data.status;
  const cancelReason = String(v.data.cancelReason || '').trim();

  const order = await prisma.ipdOrder.findFirst({ where: { tenantId, id: orderId } });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const current = String((order as Record<string, unknown>).status || '').toUpperCase();
  if (current === nextStatus) {
    return NextResponse.json({ success: true, noOp: true, status: current });
  }

  const allowDoctor = dev || isDoctor(role);
  const allowNurse = dev || isNurse(role);
  const allowCharge = canAccessChargeConsole({ email: user?.email, tenantId, role });

  if (nextStatus === 'ORDERED') {
    if (!allowDoctor) {
      return NextResponse.json({ error: 'Forbidden: only doctors can place orders' }, { status: 403 });
    }
    if (current !== 'DRAFT') {
      return NextResponse.json({ error: 'Invalid transition: ORDERED allowed only from DRAFT' }, { status: 400 });
    }
  } else if (nextStatus === 'DONE') {
    if (!allowNurse && !allowCharge) {
      return NextResponse.json({ error: 'Forbidden: only nurses can complete orders' }, { status: 403 });
    }
    if (current !== 'ORDERED') {
      return NextResponse.json({ error: 'Invalid transition: DONE allowed only from ORDERED' }, { status: 400 });
    }
  } else if (nextStatus === 'CANCELLED') {
    if (!allowDoctor && !allowCharge) {
      return NextResponse.json({ error: 'Forbidden: only doctors can cancel orders' }, { status: 403 });
    }
    if (!['DRAFT', 'ORDERED'].includes(current)) {
      return NextResponse.json({ error: 'Invalid transition: CANCELLED allowed only from DRAFT or ORDERED' }, { status: 400 });
    }
    if (!cancelReason) {
      return NextResponse.json({ error: 'cancelReason is required to cancel an order' }, { status: 400 });
    }
  } else if (nextStatus === 'DRAFT') {
    return NextResponse.json({ error: 'Invalid transition' }, { status: 400 });
  }

  const now = new Date();
  const patch: any = {
    status: nextStatus,
    updatedAt: now,
    updatedByUserId: userId,
  };
  if (nextStatus === 'ORDERED') {
    patch.orderedAt = now;
    patch.orderedByUserId = userId;
  }
  if (nextStatus === 'DONE') {
    patch.completedAt = now;
    patch.completedByUserId = userId;
  }
  if (nextStatus === 'CANCELLED') {
    patch.cancelledAt = now;
    patch.cancelledByUserId = userId;
    patch.cancelReason = cancelReason;
  }

  await prisma.ipdOrder.update({ where: { id: orderId }, data: patch });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'ipd_order',
    entityId: orderId,
    action: 'SET_STATUS',
    before: { status: current },
    after: nextStatus === 'CANCELLED' ? { status: nextStatus, cancelReason } : { status: nextStatus },
    ip,
  });

  return NextResponse.json({ success: true, status: nextStatus });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
