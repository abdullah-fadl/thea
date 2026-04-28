import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {

  const params = req.nextUrl.searchParams;
  const encounterCoreId = String(params.get('encounterCoreId') || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const episode = await prisma.ipdEpisode.findFirst({
    where: {
      tenantId,
      OR: [
        { source: { path: ['encounterId'], equals: encounterCoreId } },
        { encounterId: encounterCoreId },
      ],
    },
  });
  return NextResponse.json({ episode: episode || null });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);
