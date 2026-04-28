import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getStewardshipSummary, recordAntibioticUsage } from '@/lib/analytics/antibiotic';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const params = new URL(req.url).searchParams;

    const now = new Date();
    const daysBack = parseInt(params.get('days') || '90', 10);
    const range = {
      start: params.get('start') ? new Date(params.get('start')!) : new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000),
      end: params.get('end') ? new Date(params.get('end')!) : now,
    };

    const summary = await getStewardshipSummary(tenantId, range);
    return NextResponse.json(summary);
  }),
  { tenantScoped: true, permissionKey: 'admin.settings.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const body = await req.json();

    if (!body.patientId || !body.drugName || !body.category) {
      return NextResponse.json(
        { error: 'patientId, drugName, and category are required' },
        { status: 400 },
      );
    }

    const record = await recordAntibioticUsage(tenantId, body);
    return NextResponse.json(record, { status: 201 });
  }),
  { tenantScoped: true, permissionKey: 'opd.orders.create' },
);
