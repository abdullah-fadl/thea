import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }, params: any) => {
    try {
      const itemId = Object.values(params)[0];
      const body = await req.json().catch(() => ({}));
      const item = await (prisma as Record<string, any>).mciIncident.update({
        where: { id: itemId, tenantId },
        data: {
          status: "DEACTIVATED",
          deactivatedAt: new Date(),
          deactivatedByUserId: userId,
          deactivationReason: body.deactivationReason,
        },
      });
      await createAuditLog(
        'mci_incident',
        String(itemId),
        'MCI_INCIDENT_DEACTIVATED',
        userId || 'system',
        undefined,
        {},
        tenantId
      );

      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[MCIINCIDENT DEACTIVATE] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to deactivate' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.mci.edit' }
);
