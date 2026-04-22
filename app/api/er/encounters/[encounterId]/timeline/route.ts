import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const routeParams = params || {};
  const encounterId = String((routeParams as Record<string, string>).encounterId || '');
  if (!encounterId) {
    return NextResponse.json({ error: 'Encounter ID is required' }, { status: 400 });
  }

  const items = await prisma.auditLog.findMany({
    where: {
      tenantId,
      OR: [
        { resourceType: 'encounter', resourceId: encounterId },
        { metadata: { path: ['after', 'encounterId'], equals: encounterId } },
        { metadata: { path: ['before', 'encounterId'], equals: encounterId } },
      ],
    },
    orderBy: { timestamp: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      entityType: item.resourceType,
      entityId: item.resourceId,
      action: item.action,
      createdAt: item.timestamp,
      userId: item.actorUserId,
      after: (item.metadata as Record<string, unknown>)?.after ?? null,
      before: (item.metadata as Record<string, unknown>)?.before ?? null,
    })),
  });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.encounter.view' }
);
