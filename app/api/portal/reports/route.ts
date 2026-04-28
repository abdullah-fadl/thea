import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requirePortalSession } from '@/lib/portal/auth';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withErrorHandler(async (request: NextRequest) => {
  const payload = await requirePortalSession(request);
  if (payload instanceof NextResponse) return payload;

  const portalUser: any = await prisma.patientPortalUser.findFirst({
    where: { tenantId: payload.tenantId, id: payload.portalUserId },
  });
  if (!portalUser?.patientMasterId) {
    return NextResponse.json({ items: [] });
  }

  const encounters = await prisma.encounterCore.findMany({
    where: { tenantId: payload.tenantId, patientId: portalUser.patientMasterId, encounterType: 'OPD' },
    orderBy: [{ openedAt: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  });

  const items = encounters.map((encounter: any) => ({
    encounterCoreId: encounter.id,
    openedAt: encounter.openedAt || encounter.createdAt || null,
    encounterType: encounter.encounterType || null,
    status: encounter.status || null,
  }));

  return NextResponse.json({ items });
});
