import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { createAuditLog } from '@/lib/utils/audit';
import { allocatePricingPackageCode } from '@/lib/billing/pricingPackageCode';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { normalizeArabicNumerals } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATUSES = new Set(['ACTIVE', 'INACTIVE']);

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const search = normalizeArabicNumerals(String(req.nextUrl.searchParams.get('search') || req.nextUrl.searchParams.get('q') || '').trim());
  const where: any = { tenantId };
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  const items = await prisma.pricingPackage.findMany({
    where,
    orderBy: [{ createdAt: 'asc' }],
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
    name: z.string().min(1),
    description: z.string().optional(),
    fixedPrice: z.number(),
    status: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const name = String(body.name || '').trim();
  const description = String(body.description || '').trim();
  const fixedPrice = Number(body.fixedPrice);
  const status = String(body.status || 'ACTIVE').trim().toUpperCase();

  const missing: string[] = [];
  const invalid: string[] = [];
  if (!name) missing.push('name');
  if (Number.isNaN(fixedPrice)) missing.push('fixedPrice');
  if (status && !STATUSES.has(status)) invalid.push('status');
  if (missing.length || invalid.length) {
    return NextResponse.json({ error: 'Validation failed', missing, invalid }, { status: 400 });
  }

  const existingByName = await prisma.pricingPackage.findFirst({
    where: { tenantId, nameLower: name.toLowerCase() },
  });
  if (existingByName) {
    return NextResponse.json({ error: 'Package name already exists' }, { status: 409 });
  }

  const code = await allocatePricingPackageCode({ tenantId });
  if (!code) return NextResponse.json({ error: 'Unable to allocate code' }, { status: 500 });

  const now = new Date();
  const item = await prisma.pricingPackage.create({
    data: {
      id: uuidv4(),
      tenantId,
      code,
      name,
      nameLower: name.toLowerCase(),
      description: description || null,
      fixedPrice,
      overridesCharges: true,
      status,
      createdAt: now,
      createdByUserId: userId,
    },
  });

  await createAuditLog(
    'pricing_packages',
    item.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: item },
    tenantId
  );

  return NextResponse.json({ item });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' });

export const DELETE = withAuthTenant(
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

  const deleteSchema = z.object({ id: z.string().min(1) }).passthrough();
  const vd = validateBody(body, deleteSchema);
  if ('error' in vd) return vd.error;

  const id = String(body.id || '').trim();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const existing = await prisma.pricingPackage.findFirst({ where: { tenantId, id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.pricingPackage.delete({ where: { id } });

  await createAuditLog(
    'pricing_packages',
    id,
    'DELETE',
    userId || 'system',
    user?.email,
    { before: existing },
    tenantId
  );

  return NextResponse.json({ ok: true });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' });
