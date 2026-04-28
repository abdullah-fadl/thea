import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { isEnabled } from '@/lib/core/flags';
import { featureDisabledOutcome } from '@/lib/fhir/errors';
import { handleFhirSearch } from '@/lib/fhir/routeHelpers';

export const dynamic = 'force-dynamic';

const FHIR_HEADERS = { 'Content-Type': 'application/fhir+json' } as const;

/**
 * GET /api/fhir/Patient
 * Search patients by _id, _lastUpdated, name, or identifier.
 * Returns a FHIR Bundle (searchset).
 * Requires FF_FHIR_API_ENABLED=true + permission fhir.patient.read.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    if (!isEnabled('FF_FHIR_API_ENABLED')) {
      return NextResponse.json(featureDisabledOutcome(), { status: 404, headers: FHIR_HEADERS });
    }
    return handleFhirSearch(req, tenantId, 'Patient');
  }),
  { tenantScoped: true, permissionKey: 'fhir.patient.read' },
);
