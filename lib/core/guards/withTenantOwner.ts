/**
 * withTenantOwner — route wrapper for tenant-owner–scoped API endpoints.
 *
 * Enforces three invariants:
 *   1. FF_TENANT_OWNER_ROLE is ON — otherwise 404 (route not exposed).
 *   2. Caller is authenticated and holds the `tenant-owner` role.
 *   3. Caller's tenantId (from JWT) is a valid UUID — the handler then
 *      uses ONLY this value for DB queries, preventing cross-tenant access.
 *
 * Usage mirrors withAuthTenant:
 *   export const GET = withTenantOwner(async (req, { user, tenantId, userId }) => { ... });
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, type AuthenticatedUser } from '@/lib/auth/requireAuth';
import { isEnabled } from '@/lib/core/flags';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TenantOwnerContext {
  user: AuthenticatedUser['user'];
  tenantId: string;
  userId: string;
}

export type TenantOwnerHandler = (
  request: NextRequest,
  context: TenantOwnerContext,
  params?: Record<string, string | string[]>,
) => Promise<NextResponse>;

export function withTenantOwner(handler: TenantOwnerHandler) {
  return async (
    request: NextRequest,
    routeContext?: {
      params?:
        | Record<string, string | string[]>
        | Promise<Record<string, string | string[]>>;
    },
  ): Promise<NextResponse> => {
    if (!isEnabled('FF_TENANT_OWNER_ROLE')) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { user, tenantId } = authResult;

    if (String(user.role ?? '').toLowerCase() !== 'tenant-owner') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'tenant-owner role required' },
        { status: 403 },
      );
    }

    if (!tenantId || !UUID_RE.test(tenantId)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'No tenant selected' },
        { status: 403 },
      );
    }

    const params =
      routeContext?.params instanceof Promise
        ? await routeContext.params
        : routeContext?.params;

    return handler(request, { user, tenantId, userId: user.id }, params);
  };
}
