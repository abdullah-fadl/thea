import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { createAuditLog } from '@/lib/utils/audit';
import { requireAdminDeleteCode } from '@/lib/clinicalInfra/access';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATUSES = new Set(['ACTIVE', 'INACTIVE']);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = String((params as Record<string, string>)?.id || '').trim();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const bodySchema = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    fixedPrice: z.number().optional(),
    status: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const guard = requireAdminDeleteCode(req, body);
  if (guard) return guard;

  const existing = await prisma.pricingPackage.findFirst({ where: { tenantId, id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const ex = existing as Record<string, unknown>;

  const name = body.name !== undefined ? String(body.name || '').trim() : String(ex.name || '');
  const description = body.description !== undefined ? String(body.description || '').trim() : String(ex.description || '');
  const fixedPrice = body.fixedPrice !== undefined ? Number(body.fixedPrice) : Number(ex.fixedPrice);
  const status = body.status !== undefined ? String(body.status || '').trim().toUpperCase() : String(ex.status || '');

  const invalid: string[] = [];
  if (body.name !== undefined && !name) invalid.push('name');
  if (body.fixedPrice !== undefined && Number.isNaN(fixedPrice)) invalid.push('fixedPrice');
  if (body.status !== undefined && !STATUSES.has(status as string)) invalid.push('status');
  if (invalid.length) return NextResponse.json({ error: 'Validation failed', invalid }, { status: 400 });

  if (name && name.toLowerCase() !== String(ex.nameLower || '').toLowerCase()) {
    const duplicate = await prisma.pricingPackage.findFirst({
      where: { tenantId, nameLower: name.toLowerCase(), id: { not: id } },
    });
    if (duplicate) return NextResponse.json({ error: 'Package name already exists' }, { status: 409 });
  }

  const patch: any = {};
  if (name !== ex.name) patch.name = name;
  if (name.toLowerCase() !== String(ex.nameLower || '').toLowerCase()) patch.nameLower = name.toLowerCase();
  if (body.description !== undefined) patch.description = description || null;
  if (body.fixedPrice !== undefined) patch.fixedPrice = fixedPrice;
  if (body.status !== undefined) patch.status = status;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ item: existing, noOp: true });
  }

  await prisma.pricingPackage.update({ where: { id }, data: patch });
  const updated = { ...ex, ...patch };

  await createAuditLog(
    'pricing_packages',
    id,
    'UPDATE',
    userId || 'system',
    user?.email,
    { before: existing, after: updated },
    tenantId
  );

  return NextResponse.json({ item: updated });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' });
