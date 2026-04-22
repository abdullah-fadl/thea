import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import {
  getSubscription,
  deleteSubscription,
  toFhirSubscription,
} from '@/lib/fhir/subscriptions/manager';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fhir/subscriptions/[id]
 * Read a single subscription.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }, params) => {
    const id = (params as { id: string }).id;
    const sub = await getSubscription(tenantId, id);

    if (!sub) {
      return NextResponse.json(
        {
          resourceType: 'OperationOutcome',
          issue: [{ severity: 'error', code: 'not-found', diagnostics: `Subscription/${id} not found` }],
        },
        { status: 404, headers: { 'Content-Type': 'application/fhir+json' } },
      );
    }

    return NextResponse.json(toFhirSubscription(sub), {
      headers: { 'Content-Type': 'application/fhir+json' },
    });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings.view' },
);

/**
 * DELETE /api/fhir/subscriptions/[id]
 * Deactivate a subscription.
 */
export const DELETE = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }, params) => {
    const id = (params as { id: string }).id;
    const deleted = await deleteSubscription(tenantId, id);

    if (!deleted) {
      return NextResponse.json(
        {
          resourceType: 'OperationOutcome',
          issue: [{ severity: 'error', code: 'not-found', diagnostics: `Subscription/${id} not found` }],
        },
        { status: 404, headers: { 'Content-Type': 'application/fhir+json' } },
      );
    }

    return NextResponse.json(
      {
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'information', code: 'informational', diagnostics: 'Subscription deactivated' }],
      },
      { headers: { 'Content-Type': 'application/fhir+json' } },
    );
  }),
  { tenantScoped: true, permissionKey: 'admin.settings.create' },
);
