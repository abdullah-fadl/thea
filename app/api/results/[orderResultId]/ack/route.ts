import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { ensureResultsWriteAllowed } from '@/lib/core/guards/resultsGuard';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function canAck(role: string, user: Record<string, unknown>, _tenantId: string) {
  const roleLower = String(role || user?.role || '').toLowerCase();
  return (
    roleLower.includes('doctor') ||
    roleLower.includes('nurse') ||
    roleLower.includes('charge') ||
    roleLower.includes('admin')
  );
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  const orderResultId = String((params as Record<string, string>)?.orderResultId || '').trim();
  if (!orderResultId) {
    return NextResponse.json({ error: 'orderResultId is required' }, { status: 400 });
  }

  if (!canAck(String(role || ''), user as any, tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    comment: z.string().optional(),
    idempotencyKey: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const comment = body.comment ? String(body.comment || '').trim() : null;
  const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey || '').trim() : null;

  const result = await prisma.orderResult.findFirst({
    where: { tenantId, id: orderResultId },
  });
  if (!result) {
    return NextResponse.json({ error: 'Order result not found' }, { status: 404 });
  }

  const guard = await ensureResultsWriteAllowed({
    tenantId,
    encounterCoreId: String((result as Record<string, unknown>).encounterCoreId || ''),
  });
  if (guard) return guard;

  const existing = await prisma.resultAck.findFirst({
    where: { tenantId, orderResultId, userId },
  });
  if (existing) {
    return NextResponse.json({ success: true, noOp: true, id: existing.id, ack: existing });
  }
  if (idempotencyKey) {
    const existingKey = await prisma.resultAck.findFirst({
      where: { tenantId, idempotencyKey },
    });
    if (existingKey) {
      return NextResponse.json({ success: true, noOp: true, id: existingKey.id, ack: existingKey });
    }
  }

  const now = new Date();
  const ack = await prisma.resultAck.create({
    data: {
      tenantId,
      orderResultId,
      orderId: (result as Record<string, unknown>).orderId as string,
      userId: userId || null,
      roleAtAck: String(role || user?.role || 'unknown'),
      ackAt: now,
      comment,
      idempotencyKey: idempotencyKey || null,
    },
  });

  await createAuditLog(
    'result_ack',
    ack.id,
    'ACK',
    userId || 'system',
    user?.email,
    { after: ack, meta: { orderResultId, orderId: (result as Record<string, unknown>).orderId } },
    tenantId
  );

  return NextResponse.json({ ack });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'results.inbox.view' }
);
