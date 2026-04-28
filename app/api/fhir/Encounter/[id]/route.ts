import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { isEnabled } from '@/lib/core/flags';
import { featureDisabledOutcome } from '@/lib/fhir/errors';
import { handleFhirRead } from '@/lib/fhir/routeHelpers';

export const dynamic = 'force-dynamic';

const FHIR_HEADERS = { 'Content-Type': 'application/fhir+json' } as const;

/**
 * GET /api/fhir/Encounter/[id]
 * Read a single encounter by logical ID.
 * Returns FhirEncounter or OperationOutcome 404 if not found.
 * Requires FF_FHIR_API_ENABLED=true + permission fhir.patient.read.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }, params) => {
    if (!isEnabled('FF_FHIR_API_ENABLED')) {
      return NextResponse.json(featureDisabledOutcome(), { status: 404, headers: FHIR_HEADERS });
    }
    return handleFhirRead(tenantId, 'Encounter', (params as { id: string }).id);
  }),
  { tenantScoped: true, permissionKey: 'fhir.patient.read' },
);
