import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const { proxyId, method, documentUrl } = await req.json();
      const item = await prisma.portalProxyAccess.update({
        where: { id: proxyId, tenantId },
        data: { verificationMethod: method, verificationDocumentUrl: documentUrl },
      });
      return NextResponse.json({ item, verified: true });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'portal.proxy-access.edit' }
);
