import { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { handleFhirSearch, handleFhirCreate } from '@/lib/fhir/routeHelpers';
import { fromFhirMedicationRequest } from '@/lib/fhir/mappers/fromFhir';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    return handleFhirSearch(req, tenantId, 'MedicationRequest');
  }),
  { tenantScoped: true, permissionKey: 'pharmacy.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    return handleFhirCreate(req, tenantId, 'MedicationRequest', fromFhirMedicationRequest);
  }),
  { tenantScoped: true, permissionKey: 'pharmacy.prescribe' },
);
