import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }, params: any) => {
    try {
      const existing = await (prisma as Record<string, any>).brainDeathProtocol.findFirst({
        where: { tenantId, episodeId: params.episodeId }, orderBy: { createdAt: 'desc' },
      });
      if (!existing) return NextResponse.json({ error: 'No protocol found' }, { status: 404 });
      const item = await (prisma as Record<string, any>).brainDeathProtocol.update({
        where: { id: existing.id },
        data: { status: 'DECLARED', declaredAt: new Date(), declaredByUserId: userId },
      });
      return NextResponse.json({ item });
    } catch (e) {
      return NextResponse.json({ error: 'Failed to declare' }, { status: 500 });
    }
  },
  { permissionKey: 'icu.brain-death.edit' }
);
