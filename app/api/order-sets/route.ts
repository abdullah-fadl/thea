import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';
import { createOrderSetSchema } from '@/lib/validation/orders.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SCOPES = new Set(['ER', 'OPD', 'IPD', 'GLOBAL']);
const STATUSES = new Set(['ACTIVE', 'ARCHIVED']);
const ROLE_SCOPES = new Set(['doctor', 'charge']);

function isPrivileged(role: string, user: any, _tenantId: string) {
  const roleLower = String(role || user?.role || '').toLowerCase();
  return roleLower.includes('admin') || roleLower.includes('charge');
}

function roleKey(role: string, user: any) {
  const roleLower = String(role || user?.role || '').toLowerCase();
  if (roleLower.includes('charge')) return 'charge';
  if (roleLower.includes('doctor') || roleLower.includes('physician')) return 'doctor';
  return roleLower;
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, role, user }) => {
  const params = req.nextUrl.searchParams;
  const scope = String(params.get('scope') || '').trim().toUpperCase();
  const includeArchived = String(params.get('includeArchived') || '') === '1';
  const mode = String(params.get('mode') || '').trim().toLowerCase();
  const search = String(params.get('search') || '').trim();
  const category = String(params.get('category') || '').trim().toLowerCase();
  const includeItems = String(params.get('includeItems') || '') === '1';

  const filter: any = { tenantId };
  if (scope) {
    filter.scope = { in: [scope, 'GLOBAL'] };
  }
  if (!includeArchived) {
    filter.status = 'ACTIVE';
  }
  if (search) {
    filter.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (category) {
    const normalized = category.toUpperCase();
    if (SCOPES.has(normalized)) {
      filter.scope = { in: [normalized, 'GLOBAL'] };
    } else {
      filter.category = category;
    }
  }

  const sets = await prisma.orderSet.findMany({
    where: filter,
    orderBy: { createdAt: 'asc' },
  });

  const canSeeAll = mode === 'admin' && isPrivileged(String(role || ''), user, tenantId);
  let scoped = sets;
  if (!canSeeAll) {
    const currentRole = roleKey(String(role || ''), user);
    scoped = sets.filter((set: any) => {
      const roles = Array.isArray(set.roleScope) ? set.roleScope : [];
      if (!roles.length) return true;
      return roles.includes(currentRole);
    });
  }

  if (!includeItems) {
    return NextResponse.json({ items: scoped });
  }

  const orderSetIds = scoped.map((set: any) => set.id);
  const items = orderSetIds.length
    ? await prisma.orderSetItem.findMany({
        where: { tenantId, orderSetId: { in: orderSetIds } },
        orderBy: { position: 'asc' },
      })
    : [];
  const itemsBySet = new Map<string, any[]>();
  for (const item of items) {
    const list = itemsBySet.get((item as any).orderSetId) || [];
    list.push(item);
    itemsBySet.set((item as any).orderSetId, list);
  }

  const withItems = scoped.map((set: any) => ({
    ...set,
    items: itemsBySet.get(set.id) || [],
  }));

  return NextResponse.json({ items: withItems });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'order.sets.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
  if (!isPrivileged(String(role || ''), user, tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, createOrderSetSchema);
  if ('error' in v) return v.error;

  const missing: string[] = [];
  const invalid: string[] = [];
  const name = String(body.name || '').trim();
  const description = body.description ? String(body.description || '').trim() : null;
  const scope = String(body.scope || '').trim().toUpperCase();
  const departmentKeys = Array.isArray(body.departmentKeys) ? body.departmentKeys.map((k: any) => String(k).trim()) : [];
  const roleScope = Array.isArray(body.roleScope) ? body.roleScope.map((r: any) => String(r).trim().toLowerCase()) : [];
  const status = String(body.status || 'ACTIVE').trim().toUpperCase();

  if (!name) missing.push('name');
  if (!scope) missing.push('scope');
  if (scope && !SCOPES.has(scope)) invalid.push('scope');
  if (status && !STATUSES.has(status)) invalid.push('status');
  if (roleScope.some((r: string) => !ROLE_SCOPES.has(r))) invalid.push('roleScope');

  if (missing.length || invalid.length) {
    return NextResponse.json({ error: 'Validation failed', missing, invalid }, { status: 400 });
  }

  const now = new Date();
  const orderSet = await prisma.orderSet.create({
    data: {
      tenantId,
      name,
      description,
      scope,
      departmentKeys,
      roleScope,
      status,
      createdByUserId: userId || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  await createAuditLog(
    'order_set',
    orderSet.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: orderSet },
    tenantId
  );

  return NextResponse.json({ orderSet });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'order.sets.view' }
);
