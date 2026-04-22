import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getCredentialingDashboardStats } from '@/lib/credentialing/engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/credentialing/dashboard
 * Dashboard stats: total staff, active/expired/expiring credentials, unverified count
 */
export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }) => {
    const stats = await getCredentialingDashboardStats(tenantId);
    return NextResponse.json(stats);
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'credentialing.view' },
);
