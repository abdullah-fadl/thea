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
  const resourceId = String(params.get('resourceId') || '').trim();
  const date = String(params.get('date') || '').trim();
  if (!resourceId || !date) {
    return NextResponse.json({ error: 'resourceId and date are required' }, { status: 400 });
  }

  const slots = await prisma.schedulingSlot.findMany({
    where: { tenantId, resourceId, date },
    orderBy: [{ startAt: 'asc' }],
    take: 200,
  });

  if (!slots.length) {
    return NextResponse.json({ items: [] });
  }

  const slotIds = slots.map((s) => s.id);
  const reservations = await prisma.schedulingReservation.findMany({
    where: { tenantId, slotId: { in: slotIds }, status: 'ACTIVE' },
  });
  const resBySlot = reservations.reduce<Record<string, any>>((acc, res) => {
    acc[res.slotId] = res;
    return acc;
  }, {});

  const items = slots.map((slot) => ({
    ...slot,
    reservation: resBySlot[slot.id] || null,
  }));

  return NextResponse.json({ items });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.view' }
);
