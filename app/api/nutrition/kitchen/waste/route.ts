import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const cards = await (prisma as Record<string, any>).kitchenTrayCard.findMany({
        where: { tenantId, status: 'RETURNED' },
        orderBy: { returnedAt: 'desc' }, take: 200,
      });
      const full = cards.filter((c: any) => c.wasteAmount === 'FULL').length;
      const partial = cards.filter((c: any) => c.wasteAmount === 'PARTIAL').length;
      const none = cards.filter((c: any) => c.wasteAmount === 'NONE').length;
      return NextResponse.json({ total: cards.length, full, partial, none, cards });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'nutrition.kitchen.view' }
);
