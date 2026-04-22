import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import {
  getSurveillanceSummary,
  reportInfection,
  updateInfectionStatus,
  listInfections,
} from '@/lib/analytics/infection';
import type { InfectionType } from '@/lib/analytics/infection';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const params = new URL(req.url).searchParams;

    // Surveillance summary
    if (params.get('view') === 'summary') {
      const now = new Date();
      const daysBack = parseInt(params.get('days') || '90', 10);
      const range = {
        start: new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000),
        end: now,
      };
      const summary = await getSurveillanceSummary(tenantId, range);
      return NextResponse.json(summary);
    }

    // List infections
    const infections = await listInfections(tenantId, {
      type: params.get('type') as InfectionType | undefined,
      department: params.get('department') || undefined,
      status: params.get('status') || undefined,
      isHAI: params.get('hai') === 'true' ? true : undefined,
      limit: parseInt(params.get('limit') || '100', 10),
    });

    return NextResponse.json({ infections, total: infections.length });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();

    // Update status
    if (body.action === 'update_status' && body.eventId) {
      const updated = await updateInfectionStatus(tenantId, body.eventId, body.status, body.notes);
      if (!updated) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    // Report new infection
    if (!body.patientId || !body.type || !body.department) {
      return NextResponse.json(
        { error: 'patientId, type, and department are required' },
        { status: 400 },
      );
    }

    const event = await reportInfection(tenantId, userId, body);
    return NextResponse.json(event, { status: 201 });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings.create' },
);
