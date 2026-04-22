import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import {
  listEscalationRules,
  createEscalationRule,
  updateEscalationRule,
  seedDefaultEscalationRules,
  runEscalationCheck,
  acknowledgeEscalation,
  getActiveEscalations,
} from '@/lib/workflow/escalation';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const params = new URL(req.url).searchParams;

    if (params.get('seed') === 'true') {
      await seedDefaultEscalationRules(tenantId, userId);
    }

    if (params.get('active') === 'true') {
      const events = await getActiveEscalations(tenantId, {
        trigger: params.get('trigger') || undefined,
        limit: parseInt(params.get('limit') || '50', 10),
      });
      return NextResponse.json({ escalations: events, total: events.length });
    }

    const rules = await listEscalationRules(tenantId);
    return NextResponse.json({ rules, total: rules.length });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();

    // Run escalation check
    if (body.action === 'check') {
      const events = await runEscalationCheck(tenantId);
      return NextResponse.json({ newEscalations: events, count: events.length });
    }

    // Acknowledge escalation
    if (body.action === 'acknowledge' && body.eventId) {
      const acked = await acknowledgeEscalation(tenantId, body.eventId, userId);
      if (!acked) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    // Create new rule
    if (!body.name || !body.trigger || !body.levels) {
      return NextResponse.json({ error: 'name, trigger, and levels are required' }, { status: 400 });
    }

    const rule = await createEscalationRule(tenantId, userId, body);
    return NextResponse.json(rule, { status: 201 });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings.create' },
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const updated = await updateEscalationRule(tenantId, body.id, body);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings.create' },
);
