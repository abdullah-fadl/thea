import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { getStoreInventory, getStoreStats, adjustStoreItem } from '@/lib/consumables/inventory';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const storeId = req.nextUrl.searchParams.get('storeId') || '';
    if (!storeId) return NextResponse.json({ error: 'storeId is required' }, { status: 400 });

    const status = req.nextUrl.searchParams.get('status') || undefined;
    const search = req.nextUrl.searchParams.get('search') || undefined;

    const [items, stats] = await Promise.all([
      getStoreInventory(tenantId, storeId, { status, search }),
      getStoreStats(tenantId, storeId),
    ]);

    return NextResponse.json({ items, stats });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);

const adjustSchema = z.object({
  storeId: z.string().min(1),
  supplyCatalogId: z.string().min(1),
  movementType: z.enum(['RECEIVE', 'ISSUE', 'RETURN', 'ADJUST', 'WASTE', 'TRANSFER', 'COUNT']),
  quantity: z.number().int().min(0),
  reason: z.string().optional(),
  batchNumber: z.string().optional(),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();
    const v = validateBody(body, adjustSchema);
    if ('error' in v) return v.error;

    const result = await adjustStoreItem({
      tenantId,
      storeId: body.storeId,
      supplyCatalogId: body.supplyCatalogId,
      movementType: body.movementType,
      quantity: body.quantity,
      reason: body.reason,
      batchNumber: body.batchNumber,
      userId,
    });

    return NextResponse.json({ ok: true, ...result });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
