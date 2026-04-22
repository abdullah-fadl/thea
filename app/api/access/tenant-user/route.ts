import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { resolveTenantUser } from '@/lib/access/tenantUser';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }) => {
  const resolved = await resolveTenantUser({ tenantId, userId, user });
  if (resolved instanceof NextResponse) return resolved;

  return NextResponse.json({ tenantUser: resolved.tenantUser });
}),
  { tenantScoped: true, platformKey: 'thea_health' }
);
