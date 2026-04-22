import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const { status, ...rest } = await req.json();
      const item = await (prisma as Record<string, any>).organDonation.update({
        where: { id: params.donationId, tenantId },
        data: { status, ...rest },
      });
      return NextResponse.json({ item });
    } catch (e) {
      return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
  },
  { permissionKey: 'icu.organ-donation.edit' }
);
