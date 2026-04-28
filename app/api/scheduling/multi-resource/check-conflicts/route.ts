import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const { resources, startAt, endAt } = await req.json();
      const conflicts = [];
      for (const res of resources || []) {
        const existing = await prisma.multiResourceBooking.findMany({
          where: { tenantId, status: { not: 'CANCELLED' }, startAt: { lt: new Date(endAt) }, endAt: { gt: new Date(startAt) } },
        });
        const conflict = existing.filter((b: any) => Array.isArray(b.resources) && b.resources.some((r: any) => r.resourceId === res.resourceId));
        if (conflict.length > 0) conflicts.push({ resourceId: res.resourceId, resourceName: res.resourceName, conflictingBookings: conflict.length });
      }
      return NextResponse.json({ conflicts, hasConflicts: conflicts.length > 0 });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'scheduling.multi-resource.view' }
);
