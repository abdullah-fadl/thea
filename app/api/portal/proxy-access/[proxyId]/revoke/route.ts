import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }, params: any) => {
    try {
      const { reason } = await req.json().catch(() => ({ reason: '' }));
      const item = await prisma.portalProxyAccess.update({
        where: { id: params.proxyId, tenantId },
        data: { status: 'REVOKED', revokedAt: new Date(), revokedByUserId: userId, revokeReason: reason },
      });
      return NextResponse.json({ item });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'portal.proxy-access.edit' }
);
