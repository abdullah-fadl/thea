import { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { handleFhirRead, handleFhirUpdate } from '@/lib/fhir/routeHelpers';
import { fromFhirEncounter } from '@/lib/fhir/mappers/fromFhir';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }, params) => {
    return handleFhirRead(tenantId, 'Encounter', (params as { id: string }).id);
  }),
  { tenantScoped: true, permissionKey: 'opd.visit.view' },
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    return handleFhirUpdate(req, tenantId, 'Encounter', (params as { id: string }).id, fromFhirEncounter);
  }),
  { tenantScoped: true, permissionKey: 'opd.visit.create' },
);
