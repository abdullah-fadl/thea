import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getLowStockAlerts } from '@/lib/consumables/inventory';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }) => {
    const alerts = await getLowStockAlerts(tenantId);
    return NextResponse.json({ alerts });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
