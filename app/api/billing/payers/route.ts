import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessBilling } from '@/lib/billing/access';
import { validateBody } from '@/lib/validation/helpers';
import { createPayerSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATUSES = new Set(['ACTIVE', 'INACTIVE']);

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const status = String(req.nextUrl.searchParams.get('status') || '').trim().toUpperCase();
  const q = String(req.nextUrl.searchParams.get('q') || '').trim().toLowerCase();

  const where: any = { tenantId };
  if (status && STATUSES.has(status)) where.status = status;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { code: { contains: q, mode: 'insensitive' } },
    ];
  }

  const items = await prisma.billingPayer.findMany({
    where,
    orderBy: [{ createdAt: 'asc' }],
    take: 100,
  });

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);

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

  const v = validateBody(body, createPayerSchema);
  if ('error' in v) return v.error;

  const name = String(v.data.name || '').trim();
  const code = String(v.data.code || '').trim().toUpperCase();
  const status = String(v.data.status || 'ACTIVE').trim().toUpperCase();

  const existing = await prisma.billingPayer.findFirst({
    where: { tenantId, code },
  });
  if (existing) {
    return NextResponse.json({ payer: existing, noOp: true });
  }

  const now = new Date();

  try {
    const payer = await prisma.billingPayer.create({
      data: {
        id: uuidv4(),
        tenantId,
        name,
        code,
        status,
        createdAt: now,
        updatedAt: now,
      },
    });

    await createAuditLog(
      'billing_payer',
      payer.id,
      'CREATE',
      userId || 'system',
      user?.email,
      { after: payer },
      tenantId
    );

    return NextResponse.json({ payer });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const fallback = await prisma.billingPayer.findFirst({
        where: { tenantId, code },
      });
      if (fallback) return NextResponse.json({ payer: fallback, noOp: true });
    }
    throw err;
  }
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);
