import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requirePortalSession } from '@/lib/portal/auth';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withErrorHandler(async (request: NextRequest) => {
  const payload = await requirePortalSession(request);
  if (payload instanceof NextResponse) return payload;

  const params = request.nextUrl.searchParams;
  const resourceId = String(params.get('resourceId') || '').trim();
  const date = String(params.get('date') || '').trim();
  if (!resourceId || !date) {
    return NextResponse.json({ error: 'resourceId and date are required' }, { status: 400 });
  }

  const slots = await prisma.schedulingSlot.findMany({
    where: { tenantId: payload.tenantId, resourceId, date },
    orderBy: [{ startAt: 'asc' }],
    take: 200,
  });

  if (!slots.length) {
    return NextResponse.json({ items: [] });
  }

  const slotIds = slots.map((s: any) => String(s.id || '')).filter(Boolean);
  const reservations = await prisma.schedulingReservation.findMany({
    where: { tenantId: payload.tenantId, slotId: { in: slotIds }, status: 'ACTIVE' },
  });
  const resBySlot = reservations.reduce<Record<string, any>>((acc, res: any) => {
    acc[String(res.slotId || '')] = res;
    return acc;
  }, {});

  const items = slots.map((slot: any) => {
    const res = resBySlot[String(slot.id || '')] || null;
    return {
      id: slot.id,
      resourceId: slot.resourceId,
      date: slot.date,
      startAt: slot.startAt,
      endAt: slot.endAt,
      status: slot.status,
      slotType: slot.slotType || null,
      isAvailable: !res,
      reservation: res
        ? { id: res.id, status: res.status }
        : null,
    };
  });

  return NextResponse.json({ items });
});
