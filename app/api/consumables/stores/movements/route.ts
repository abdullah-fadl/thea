import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getMovementHistory } from '@/lib/consumables/inventory';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const storeId = req.nextUrl.searchParams.get('storeId') || '';
    if (!storeId) return NextResponse.json({ error: 'storeId is required' }, { status: 400 });

    const supplyCatalogId = req.nextUrl.searchParams.get('supplyCatalogId') || undefined;
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);

    const movements = await getMovementHistory(tenantId, storeId, { supplyCatalogId, limit });
    return NextResponse.json({ movements });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
