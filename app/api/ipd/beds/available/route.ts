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
  const departmentId = String(params.get('departmentId') || '').trim();

  const bedFilter: any = { tenantId, isActive: { not: false } };
  if (departmentId) bedFilter.departmentId = departmentId;

  const beds = await prisma.ipdBed.findMany({
    where: bedFilter,
    orderBy: [{ bedLabel: 'asc' }, { id: 'asc' }],
    take: 200,
  });

  const activeAdmissions = await prisma.ipdAdmission.findMany({
    where: { tenantId, releasedAt: null, isActive: true },
    take: 200,
  });

  const occupied = new Set(activeAdmissions.map((a: any) => String(a.bedId || '')).filter(Boolean));

  const items = beds.map((bed: any) => ({
    id: bed.id,
    bedLabel: bed.bedLabel || bed.label || bed.id,
    ward: bed.ward || bed.departmentName || bed.departmentId || null,
    room: bed.room || bed.roomLabel || bed.roomId || null,
    unit: bed.unit || bed.unitLabel || bed.unitId || null,
    departmentId: bed.departmentId || null,
    status: occupied.has(String(bed.id || '')) ? 'OCCUPIED' : 'AVAILABLE',
  }));

  return NextResponse.json({ items });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);
