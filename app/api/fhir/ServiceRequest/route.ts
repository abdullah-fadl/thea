import { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { handleFhirSearch, handleFhirCreate } from '@/lib/fhir/routeHelpers';
import { fromFhirServiceRequest } from '@/lib/fhir/mappers/fromFhir';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    return handleFhirSearch(req, tenantId, 'ServiceRequest');
  }),
  { tenantScoped: true, permissionKey: 'opd.orders.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    return handleFhirCreate(req, tenantId, 'ServiceRequest', fromFhirServiceRequest);
  }),
  { tenantScoped: true, permissionKey: 'opd.orders.create' },
);
