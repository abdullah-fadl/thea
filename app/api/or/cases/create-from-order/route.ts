import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { checkOrderPayment } from '@/lib/billing/paymentGate';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isProcedureOrder(order: { kind: string; departmentKey?: string | null }): boolean {
  const kind = String(order.kind || '').toUpperCase();
  const dept = String(order.departmentKey || '').toLowerCase();
  return kind === 'PROCEDURE' || dept === 'operating-room';
}

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    orderId: z.string().min(1),
    episodeId: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const orderId = String(body.orderId || '').trim();
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }

  const order = await prisma.ordersHub.findFirst({
    where: { tenantId, id: orderId },
  });
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (!isProcedureOrder(order)) {
    return NextResponse.json({ error: 'Order is not a procedure order' }, { status: 409 });
  }

  const paymentCheck = await checkOrderPayment(null, tenantId, orderId, 'PROCEDURE');
  if (!paymentCheck.allowed) {
    return NextResponse.json(
      {
        error: 'PAYMENT_REQUIRED',
        message: paymentCheck.reason,
        paymentStatus: paymentCheck.paymentStatus,
      },
      { status: 402 }
    );
  }

  const existing = await prisma.orCase.findFirst({
    where: { tenantId, orderId },
  });
  if (existing) {
    return NextResponse.json({ success: true, noOp: true, caseId: existing.id, case: existing });
  }

  const now = new Date();
  const orCase = {
    tenantId,
    orderId,
    encounterCoreId: String(order.encounterCoreId || ''),
    episodeId: body.episodeId ? String(body.episodeId || '').trim() : null,
    patientMasterId: order.patientMasterId || null,
    procedureName: String(order.orderName || '').trim(),
    procedureCode: String(order.orderCode || '').trim() || null,
    departmentKey: String(order.departmentKey || '').trim() || null,
    createdAt: now,
    createdByUserId: userId || null,
  };

  try {
    const created = await prisma.orCase.create({ data: orCase });
    await createAuditLog(
      'or_case',
      created.id,
      'CREATE',
      userId || 'system',
      user?.email,
      { after: created },
      tenantId
    );
    return NextResponse.json({ success: true, caseId: created.id, case: created });
  } catch (err: unknown) {
    // Unique constraint - already exists
    const duplicate = await prisma.orCase.findFirst({
      where: { tenantId, orderId },
    });
    if (duplicate) {
      return NextResponse.json({ success: true, noOp: true, caseId: duplicate.id, case: duplicate });
    }
    return NextResponse.json({ success: true, noOp: true, caseId: null });
  }
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' });
