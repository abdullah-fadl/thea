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
  const unitId = String(params.get('unitId') || '').trim();

  const units = await prisma.clinicalInfraUnit.findMany({
    where: { tenantId, status: { not: 'inactive' } },
    select: { id: true, name: true, type: true, shortCode: true },
    orderBy: [{ name: 'asc' }],
    take: 500,
  });

  let rooms: Array<{ id: string; name: string; unitId: string }> = [];
  if (unitId) {
    rooms = (await prisma.clinicalInfraRoom.findMany({
      where: { tenantId, unitId, status: { not: 'inactive' } },
      select: { id: true, name: true, unitId: true },
      orderBy: [{ name: 'asc' }],
      take: 500,
    })) as any;
  }

  return NextResponse.json({ units, rooms });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.encounter.view' }
);
