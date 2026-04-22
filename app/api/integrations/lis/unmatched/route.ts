import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { getUnmatchedResults } from '@/lib/integrations/lis/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
    const results = await getUnmatchedResults(null, tenantId, limit);

    return NextResponse.json({ items: results });
  }),
  { tenantScoped: true, permissionKey: 'lab.results.view' }
);
