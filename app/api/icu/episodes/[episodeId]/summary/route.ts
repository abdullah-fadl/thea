import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isDoctorOrNurse(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r.includes('doctor') || r.includes('physician') || r.includes('nurse') || r.includes('nursing');
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user }, params) => {

  const role = String((user as unknown as Record<string, unknown>)?.role || '');
  if (!isDoctorOrNurse(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const routeParams = params || {};
  const episodeId = String((routeParams as Record<string, string>).episodeId || '').trim();
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
  }

  const episode = await prisma.ipdEpisode.findFirst({
    where: { tenantId, id: episodeId },
  });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }

  return NextResponse.json({ episode });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'icu.view' }
);
