import { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { handleFhirRead, handleFhirUpdate } from '@/lib/fhir/routeHelpers';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }, params) => {
    return handleFhirRead(tenantId, 'Procedure', (params as { id: string }).id);
  }),
  { tenantScoped: true, permissionKey: 'opd.orders.view' },
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    return handleFhirUpdate(req, tenantId, 'Procedure', (params as { id: string }).id);
  }),
  { tenantScoped: true, permissionKey: 'opd.orders.create' },
);
