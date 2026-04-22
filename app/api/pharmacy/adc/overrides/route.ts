import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const items = await prisma.adcTransaction.findMany({
        where: { tenantId, isOverride: true }, orderBy: { createdAt: 'desc' }, take: 100,
      });
      return NextResponse.json({ items });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'pharmacy.adc.view' }
);
