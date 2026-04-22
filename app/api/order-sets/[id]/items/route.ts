import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { createOrderSetItemSchema } from '@/lib/validation/orders.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KINDS = new Set(['LAB', 'RADIOLOGY', 'PROCEDURE', 'NON_MED']);

function isPrivileged(role: string, user: any, _tenantId: string) {
  const roleLower = String(role || user?.role || '').toLowerCase();
  return roleLower.includes('admin') || roleLower.includes('charge');
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const id = String((params as Record<string, string>)?.id || '').trim();
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const items = await prisma.orderSetItem.findMany({
    where: { tenantId, orderSetId: id },
    orderBy: { position: 'asc' },
  });

  return NextResponse.json({ items });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'order.sets.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  if (!isPrivileged(String(role || ''), user, tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = String((params as Record<string, string>)?.id || '').trim();
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, createOrderSetItemSchema);
  if ('error' in v) return v.error;

  const missing: string[] = [];
  const invalid: string[] = [];
  const kind = String(body.kind || '').trim().toUpperCase();
  const orderCode = String(body.orderCode || '').trim();
  const displayName = String(body.displayName || '').trim();
  const defaults = body.defaults && typeof body.defaults === 'object' ? body.defaults : null;
  const required = Boolean(body.required);
  const position = Number.isFinite(Number(body.position)) ? Number(body.position) : null;

  if (!kind) missing.push('kind');
  if (!orderCode) missing.push('orderCode');
  if (!displayName) missing.push('displayName');
  if (kind && !KINDS.has(kind)) invalid.push('kind');
  if (position === null) missing.push('position');

  if (missing.length || invalid.length) {
    return NextResponse.json({ error: 'Validation failed', missing, invalid }, { status: 400 });
  }

  if (kind === 'PROCEDURE' || kind === 'NON_MED') {
    const procedureCharge = await prisma.billingChargeCatalog.findFirst({
      where: { tenantId, code: orderCode, itemType: 'PROCEDURE' },
    });
    if (!procedureCharge) {
      return NextResponse.json({ error: 'Procedure charge not found', invalid: ['orderCode'] }, { status: 400 });
    }
  }

  const now = new Date();
  const item = await prisma.orderSetItem.create({
    data: {
      tenantId,
      orderSetId: id,
      kind,
      orderCode,
      displayName,
      defaults: defaults as any,
      required,
      position,
      createdAt: now,
      createdByUserId: userId || null,
    },
  });

  return NextResponse.json({ item });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'order.sets.view' }
);
