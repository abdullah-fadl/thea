import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { runConsumableCheckoutGate } from '@/lib/consumables/checkoutGate';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const encounterCoreId = req.nextUrl.searchParams.get('encounterCoreId') || '';
    if (!encounterCoreId) {
      return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
    }

    const result = await runConsumableCheckoutGate(tenantId, encounterCoreId);
    return NextResponse.json(result);
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
