import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { requireAdminDeleteCode } from '@/lib/clinicalInfra/access';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
  const guard = requireAdminDeleteCode(req, body);
  if (guard) return guard;

  const bodySchema = z.object({
    name: z.string().optional(),
    category: z.string().optional(),
    usageUnit: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const existing = await prisma.suppliesCatalog.findFirst({ where: { tenantId, id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const ex = existing as Record<string, unknown>;

  const nextName = body.name !== undefined ? String(body.name || '').trim() : String(ex.name || '');
  const nextCategory = body.category !== undefined ? String(body.category || '').trim() : String(ex.category || '');
  const nextUsageUnit = body.usageUnit !== undefined ? String(body.usageUnit || '').trim() : String(ex.usageUnit || '');
  const nextDescription =
    body.description !== undefined ? String(body.description || '').trim() : String(ex.description || '');
  const nextStatus = body.status !== undefined ? String(body.status || '').trim().toUpperCase() : String(ex.status || 'ACTIVE');

  if (body.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(nextStatus)) {
    return NextResponse.json({ error: 'Validation failed', invalid: ['status'] }, { status: 400 });
  }

  if (body.name !== undefined && !nextName) {
    return NextResponse.json({ error: 'Validation failed', invalid: ['name'] }, { status: 400 });
  }

  if (nextName && nextName.toLowerCase() !== String(ex.nameLower || '').toLowerCase()) {
    const duplicate = await prisma.suppliesCatalog.findFirst({
      where: { tenantId, nameLower: nextName.toLowerCase(), id: { not: id } },
    });
    if (duplicate) return NextResponse.json({ error: 'Supply name already exists' }, { status: 409 });
  }

  const patch: any = {};
  if (nextName !== ex.name) patch.name = nextName;
  if (nextName.toLowerCase() !== String(ex.nameLower || '').toLowerCase()) {
    patch.nameLower = nextName.toLowerCase();
  }
  if (body.category !== undefined) patch.category = nextCategory || null;
  if (body.usageUnit !== undefined) patch.usageUnit = nextUsageUnit || null;
  if (body.description !== undefined) patch.description = nextDescription || null;
  if (body.status !== undefined) patch.status = nextStatus;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ item: existing, noOp: true });
  }

  await prisma.suppliesCatalog.update({ where: { id }, data: patch });
  const updated = { ...ex, ...patch };

  await createAuditLog(
    'supplies_catalog',
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
