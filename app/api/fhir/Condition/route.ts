import { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { handleFhirSearch, handleFhirCreate } from '@/lib/fhir/routeHelpers';
import { fromFhirCondition } from '@/lib/fhir/mappers/fromFhir';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    return handleFhirSearch(req, tenantId, 'Condition');
  }),
  { tenantScoped: true, permissionKey: 'opd.visit.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    return handleFhirCreate(req, tenantId, 'Condition', fromFhirCondition);
  }),
  { tenantScoped: true, permissionKey: 'opd.visit.create' },
);
