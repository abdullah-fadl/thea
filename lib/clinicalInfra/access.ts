import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveTenantUser, normalizeRoles } from '@/lib/access/tenantUser';
import { env } from '@/lib/env';

export async function requireClinicalInfraAdmin(_req: NextRequest, args: { tenantId: string; userId: string; user: any }) {
  const resolved = await resolveTenantUser({ tenantId: args.tenantId, userId: args.userId, user: args.user });
  if (resolved instanceof NextResponse) return resolved;
  const roles = normalizeRoles(resolved.tenantUser?.roles || []);
  const ok = roles.includes('admin') || roles.includes('dev');
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return { tenantUser: resolved.tenantUser };
}

export function requireAdminDeleteCode(req: NextRequest, body?: any) {
  const expected = String(env.ADMIN_DELETE_CODE || '').trim();
  if (!expected) {
    return NextResponse.json({ error: 'Admin delete code is not configured' }, { status: 500 });
  }
  const provided = String(req.headers.get('x-admin-delete-code') || body?.adminCode || '').trim();
  if (!provided) return NextResponse.json({ error: 'Admin delete code required' }, { status: 401 });
  if (provided !== expected) return NextResponse.json({ error: 'Invalid admin delete code' }, { status: 403 });
  return null;
}

