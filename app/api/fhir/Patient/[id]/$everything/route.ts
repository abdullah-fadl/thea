import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { fhirEverything } from '@/lib/fhir/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fhir/Patient/[id]/$everything
 *
 * Returns a Bundle of all resources related to the patient.
 * Includes: Encounters, Observations, Conditions, Allergies,
 * Medications, ServiceRequests, Coverage, Procedures.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const patientId = (params as { id: string }).id;
    const baseUrl = new URL(req.url).origin;

    const bundle = await fhirEverything(tenantId, patientId, baseUrl);

    return NextResponse.json(bundle, {
      headers: { 'Content-Type': 'application/fhir+json' },
    });
  }),
  { tenantScoped: true, permissionKey: 'opd.visit.view' },
);
