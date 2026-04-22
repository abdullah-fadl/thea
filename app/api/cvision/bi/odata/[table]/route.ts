import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { requireCtx } from '@/lib/cvision/authz/enforce';
import { getODataFeed } from '@/lib/cvision/data-warehouse/bi-connector';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }, context: any) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const db = await getCVisionDb(tenantId);
  const table = context?.params?.table || '';
  const { searchParams } = new URL(request.url);

  const result = await getODataFeed(db, tenantId, `cvision_dw_${table}`, {
    filter: searchParams.get('$filter') || undefined,
    select: searchParams.get('$select') || undefined,
    orderby: searchParams.get('$orderby') || undefined,
    top: searchParams.get('$top') ? parseInt(searchParams.get('$top')!) : undefined,
    skip: searchParams.get('$skip') ? parseInt(searchParams.get('$skip')!) : undefined,
  });

  return NextResponse.json({ '@odata.context': `$metadata#${table}`, '@odata.count': result.count, value: result.value });
},
  { platformKey: 'cvision', permissionKey: 'cvision.dashboards.read' });
