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
  const episodeId = String(params.get('episodeId') || '').trim();
  const area = String(params.get('area') || '').trim().toUpperCase();

  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
  }

  const episode = await prisma.ipdEpisode.findFirst({
    where: { tenantId, id: episodeId },
  });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }

  const patientMasterId = String((episode as any)?.patient?.id || (episode as any)?.patientMasterId || '').trim();
  if (!patientMasterId) {
    return NextResponse.json({ items: [] });
  }

  const filter: any = {
    tenantId,
    patientLink: {
      path: ['patientMasterId'],
      equals: patientMasterId,
    },
  };
  if (area) {
    filter.location = {
      path: ['area'],
      equals: area,
    };
  }

  const items = await prisma.connectDeviceVitals.findMany({
    where: filter,
    orderBy: { occurredAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical.edit' }
);
