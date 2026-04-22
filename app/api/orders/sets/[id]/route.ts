import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getOrderSet, updateOrderSet, deleteOrderSet } from '@/lib/orders/orderSets';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const id = (params as { id: string }).id;
    const orderSet = await getOrderSet(tenantId, id);
    if (!orderSet) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(orderSet);
  }),
  { tenantScoped: true, permissionKey: 'opd.orders.view' },
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const id = (params as { id: string }).id;
    const body = await req.json();
    const updated = await updateOrderSet(tenantId, id, body);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  }),
  { tenantScoped: true, permissionKey: 'opd.orders.create' },
);

export const DELETE = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const id = (params as { id: string }).id;
    const deleted = await deleteOrderSet(tenantId, id);
    if (!deleted) return NextResponse.json({ error: 'Not found or is a default set' }, { status: 404 });
    return NextResponse.json({ success: true });
  }),
  { tenantScoped: true, permissionKey: 'opd.orders.create' },
);
