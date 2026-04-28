import { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { handleFhirSearch, handleFhirCreate } from '@/lib/fhir/routeHelpers';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    return handleFhirSearch(req, tenantId, 'Procedure');
  }),
  { tenantScoped: true, permissionKey: 'opd.orders.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    return handleFhirCreate(req, tenantId, 'Procedure');
  }),
  { tenantScoped: true, permissionKey: 'opd.orders.create' },
);
