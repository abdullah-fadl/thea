import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import {
  createSubscription,
  listSubscriptions,
  toFhirSubscription,
} from '@/lib/fhir/subscriptions/manager';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fhir/subscriptions
 * List all active subscriptions.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const baseUrl = new URL(req.url).origin;
    const subs = await listSubscriptions(tenantId);

    return NextResponse.json(
      {
        resourceType: 'Bundle',
        type: 'searchset',
        total: subs.length,
        entry: subs.map((s) => ({
          fullUrl: `${baseUrl}/api/fhir/subscriptions/${s.id}`,
          resource: toFhirSubscription(s),
        })),
      },
      { headers: { 'Content-Type': 'application/fhir+json' } },
    );
  }),
  { tenantScoped: true, permissionKey: 'admin.settings.view' },
);

/**
 * POST /api/fhir/subscriptions
 * Create a new subscription.
 * Body: FHIR Subscription resource
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const body = await req.json();

    if (!body.criteria || !body.channel) {
      return NextResponse.json(
        {
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'required',
            diagnostics: 'criteria and channel are required',
          }],
        },
        { status: 400, headers: { 'Content-Type': 'application/fhir+json' } },
      );
    }

    try {
      const record = await createSubscription(tenantId, body);
      const fhirSub = toFhirSubscription(record);

      return NextResponse.json(fhirSub, {
        status: 201,
        headers: {
          'Content-Type': 'application/fhir+json',
          Location: `/api/fhir/subscriptions/${record.id}`,
        },
      });
    } catch (error) {
      return NextResponse.json(
        {
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'invalid',
            diagnostics: error instanceof Error ? error.message : 'Failed to create subscription',
          }],
        },
        { status: 400, headers: { 'Content-Type': 'application/fhir+json' } },
      );
    }
  }),
  { tenantScoped: true, permissionKey: 'admin.settings.create' },
);
