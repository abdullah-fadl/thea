import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {

  const routeParams = params || {};
  const episodeId = String((routeParams as Record<string, string>).episodeId || '').trim();
  if (!episodeId) return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) return NextResponse.json({ error: 'Episode not found' }, { status: 404 });

  const encounterCoreId = String((episode as Record<string, unknown>)?.encounterId || '').trim();
  if (encounterCoreId) {
    const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
    if (deathGuard) return deathGuard;
  }

  const activeAdmission = await prisma.ipdAdmission.findFirst({
    where: { tenantId, episodeId, releasedAt: null, isActive: true },
  });
  if (!activeAdmission) {
    return NextResponse.json({ success: true, noOp: true });
  }

  const now = new Date();
  await prisma.ipdAdmission.update({
    where: { id: activeAdmission.id },
    data: { releasedAt: now, releasedByUserId: userId || null, isActive: false },
  });

  await createAuditLog(
    'ipd_bed_assignment',
    activeAdmission.id,
    'RELEASE',
    userId || 'system',
    user?.email,
    { before: activeAdmission, after: { releasedAt: now } },
    tenantId
  );

  return NextResponse.json({ success: true });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
