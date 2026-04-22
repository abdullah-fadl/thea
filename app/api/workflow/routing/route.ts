import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import {
  listRoutingRules,
  createRoutingRule,
  updateRoutingRule,
  deleteRoutingRule,
  seedDefaultRoutingRules,
  applyRoutingRules,
} from '@/lib/workflow/routing';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    if (new URL(req.url).searchParams.get('seed') === 'true') {
      await seedDefaultRoutingRules(tenantId, userId);
    }

    const rules = await listRoutingRules(tenantId);
    return NextResponse.json({ rules, total: rules.length });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();

    // Apply routing to existing order
    if (body.action === 'apply' && body.orderId) {
      const order = await prisma.ordersHub.findFirst({
        where: { tenantId, id: body.orderId },
      });
      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      const results = await applyRoutingRules(tenantId, body.orderId, order as Record<string, unknown>);
      return NextResponse.json({ results });
    }

    // Create new rule
    if (!body.name || !body.conditions || !body.actions) {
      return NextResponse.json({ error: 'name, conditions, and actions are required' }, { status: 400 });
    }

    const rule = await createRoutingRule(tenantId, userId, body);
    return NextResponse.json(rule, { status: 201 });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings.create' },
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const updated = await updateRoutingRule(tenantId, body.id, body);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings.create' },
);

export const DELETE = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const deleted = await deleteRoutingRule(tenantId, id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings.create' },
);
