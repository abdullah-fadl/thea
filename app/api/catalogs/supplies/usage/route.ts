import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supplyCatalogId = String(req.nextUrl.searchParams.get('supplyCatalogId') || '').trim();
  const where: any = { tenantId };
  if (supplyCatalogId) where.supplyCatalogId = supplyCatalogId;

  const items = await prisma.supplyUsageEvent.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
  });

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' });

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    supplyCatalogId: z.string().min(1),
    requestId: z.string().min(1),
    quantity: z.number(),
    encounterId: z.string().optional(),
    note: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const supplyCatalogId = String(body.supplyCatalogId || '').trim();
  const requestId = String(body.requestId || '').trim();
  const quantity = Number(body.quantity);
  const encounterId = String(body.encounterId || '').trim();
  const note = String(body.note || '').trim();

  const missing: string[] = [];
  if (!supplyCatalogId) missing.push('supplyCatalogId');
  if (!requestId) missing.push('requestId');
  if (Number.isNaN(quantity)) missing.push('quantity');
  if (missing.length) return NextResponse.json({ error: 'Validation failed', missing }, { status: 400 });

  const supply = await prisma.suppliesCatalog.findFirst({
    where: { tenantId, id: supplyCatalogId },
  });
  if (!supply) return NextResponse.json({ error: 'Supply not found' }, { status: 404 });

  const now = new Date();
  const usageEventId = uuidv4();

  // Idempotency check
  try {
    await prisma.catalogUsageIdempotency.create({
      data: {
        id: uuidv4(),
        tenantId,
        requestId,
        kind: 'SUPPLY_USAGE',
        usageEventId,
        createdAt: now,
        createdByUserId: userId || null,
        createdByEmail: user?.email || null,
      },
    });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existingRecord = await prisma.catalogUsageIdempotency.findFirst({
        where: { tenantId, requestId, kind: 'SUPPLY_USAGE' },
      });
      return NextResponse.json(
        { success: true, noOp: true, id: existingRecord?.usageEventId || null },
        { headers: { 'x-idempotent-replay': '1' } }
      );
    }
    throw err;
  }

  const event = await prisma.supplyUsageEvent.create({
    data: {
      id: usageEventId,
      tenantId,
      supplyCatalogId,
      quantity,
      encounterId: encounterId || null,
      note: note || null,
      createdAt: now,
      createdByUserId: userId || null,
      createdByEmail: user?.email || null,
    },
  });

  return NextResponse.json({ success: true, id: event.id, event });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' });
