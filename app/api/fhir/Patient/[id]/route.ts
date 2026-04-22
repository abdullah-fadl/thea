import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { fhirRead, fhirUpdate } from '@/lib/fhir/server';
import { fromFhirPatient } from '@/lib/fhir/mappers/fromFhir';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fhir/Patient/[id]
 * Read a single patient by ID.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const id = (params as { id: string }).id;
    const resource = await fhirRead(tenantId, 'Patient', id);

    if ('issue' in resource) {
      const status = resource.issue[0]?.code === 'not-found' ? 404 : 400;
      return NextResponse.json(resource, {
        status,
        headers: { 'Content-Type': 'application/fhir+json' },
      });
    }

    return NextResponse.json(resource, {
      headers: { 'Content-Type': 'application/fhir+json' },
    });
  }),
  { tenantScoped: true, permissionKey: 'opd.visit.view' },
);

/**
 * PUT /api/fhir/Patient/[id]
 * Update a patient.
 */
export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const id = (params as { id: string }).id;
    const body = await req.json();
    const theaData = fromFhirPatient(body);

    const result = await fhirUpdate(tenantId, 'Patient', id, theaData);

    if ('issue' in result) {
      const status = result.issue[0]?.code === 'not-found' ? 404 : 400;
      return NextResponse.json(result, {
        status,
        headers: { 'Content-Type': 'application/fhir+json' },
      });
    }

    return NextResponse.json(result, {
      headers: { 'Content-Type': 'application/fhir+json' },
    });
  }),
  { tenantScoped: true, permissionKey: 'opd.visit.create' },
);
