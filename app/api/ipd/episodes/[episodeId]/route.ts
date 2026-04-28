import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user }, params) => {

  const routeParams = params || {};
  const episodeId = String((routeParams as Record<string, string>).episodeId || '').trim();
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
  }

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }

  return NextResponse.json({ episode });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);
