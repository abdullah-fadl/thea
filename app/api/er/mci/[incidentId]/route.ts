import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const itemId = (params as Record<string, string>).incidentId || Object.values(params)[0];
      const item = await (prisma as Record<string, any>).mciIncident.findFirst({
        where: { tenantId, id: itemId },
      });
      if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[MCIINCIDENT GET-DETAIL] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.mci.view' }
);

export const PATCH = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const itemId = (params as Record<string, string>).incidentId || Object.values(params)[0];
      const body = await req.json();
      const item = await (prisma as Record<string, any>).mciIncident.update({
        where: { id: itemId, tenantId },
        data: {
          ...(body.level !== undefined && { level: body.level }),
          ...(body.status !== undefined && { status: body.status }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.commandStructure !== undefined && { commandStructure: body.commandStructure }),
          ...(body.surgeCapacity !== undefined && { surgeCapacity: body.surgeCapacity }),
          ...(body.patientCount !== undefined && { patientCount: body.patientCount }),
        },
      });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[MCIINCIDENT PATCH] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.mci.edit' }
);
