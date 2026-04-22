import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {

  const params = req.nextUrl.searchParams;
  const encounterCoreId = String(params.get('encounterCoreId') || '').trim();
  const episodeId = String(params.get('episodeId') || '').trim();

  if (!encounterCoreId && !episodeId) {
    return NextResponse.json({ error: 'encounterCoreId or episodeId is required' }, { status: 400 });
  }

  const filter: any = { tenantId };
  if (encounterCoreId) filter.encounterCoreId = encounterCoreId;
  if (episodeId) filter.episodeId = episodeId;

  const items = await prisma.clinicalHandover.findMany({
    where: filter,
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'handover.view' }
);
