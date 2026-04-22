import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { fhirSearch, fhirCreate } from '@/lib/fhir/server';
import { fromFhirPatient } from '@/lib/fhir/mappers/fromFhir';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fhir/Patient
 * Search patients.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const baseUrl = new URL(req.url).origin;
    const searchParams = new URL(req.url).searchParams;

    const bundle = await fhirSearch(tenantId, 'Patient', searchParams, baseUrl);

    return NextResponse.json(bundle, {
      headers: { 'Content-Type': 'application/fhir+json' },
    });
  }),
  { tenantScoped: true, permissionKey: 'opd.visit.view' },
);

/**
 * POST /api/fhir/Patient
 * Create a new patient.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const body = await req.json();
    if (body.resourceType !== 'Patient') {
      return NextResponse.json(
        { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'invalid', diagnostics: 'Expected resourceType Patient' }] },
        { status: 400, headers: { 'Content-Type': 'application/fhir+json' } },
      );
    }

    const theaData = fromFhirPatient(body);
    const result = await fhirCreate(tenantId, 'Patient', theaData);

    if ('issue' in result) {
      return NextResponse.json(result, {
        status: 400,
        headers: { 'Content-Type': 'application/fhir+json' },
      });
    }

    return NextResponse.json(result.resource, {
      status: 201,
      headers: {
        'Content-Type': 'application/fhir+json',
        Location: `/api/fhir/Patient/${result.id}`,
      },
    });
  }),
  { tenantScoped: true, permissionKey: 'opd.visit.create' },
);
