import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { listOrderSets, createOrderSet, executeOrderSet, seedDefaultOrderSets } from '@/lib/orders/orderSets';

export const dynamic = 'force-dynamic';

/**
 * GET /api/orders/sets
 * List order sets. Query: ?category=Emergency&activeOnly=true&seed=true
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const params = new URL(req.url).searchParams;

    // Seed defaults if requested
    if (params.get('seed') === 'true') {
      await seedDefaultOrderSets(tenantId, userId);
    }

    const sets = await listOrderSets(tenantId, {
      category: params.get('category') || undefined,
      activeOnly: params.get('activeOnly') === 'true',
    });

    return NextResponse.json({ orderSets: sets, total: sets.length });
  }),
  { tenantScoped: true, permissionKey: 'opd.orders.view' },
);

/**
 * POST /api/orders/sets
 * Create a new order set OR execute an existing one.
 * Body: { action: 'create' | 'execute', ... }
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();

    if (body.action === 'execute') {
      if (!body.orderSetId || !body.patientId || !body.encounterId) {
        return NextResponse.json(
          { error: 'orderSetId, patientId, and encounterId are required' },
          { status: 400 },
        );
      }

      const result = await executeOrderSet(tenantId, userId, {
        orderSetId: body.orderSetId,
        patientId: body.patientId,
        encounterId: body.encounterId,
      });

      return NextResponse.json(result, { status: result.errors.length > 0 ? 207 : 201 });
    }

    // Default: create new order set
    if (!body.name || !body.nameAr || !body.items) {
      return NextResponse.json(
        { error: 'name, nameAr, and items[] are required' },
        { status: 400 },
      );
    }

    const orderSet = await createOrderSet(tenantId, userId, {
      name: body.name,
      nameAr: body.nameAr,
      category: body.category || 'General',
      description: body.description,
      descriptionAr: body.descriptionAr,
      items: body.items,
    });

    return NextResponse.json(orderSet, { status: 201 });
  }),
  { tenantScoped: true, permissionKey: 'opd.orders.create' },
);
