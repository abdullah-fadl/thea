import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = req.nextUrl;
      const where: any = { tenantId };
      const status = url.searchParams.get('status');
      const patientId = url.searchParams.get('patientId');
      if (status) where.status = status;
      if (patientId) where.patientId = patientId;
      
      const items = await (prisma as Record<string, any>).mciIncident.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return NextResponse.json({ items });
    } catch (e) {
      logger.error('[MCIINCIDENT GET] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.mci.view' }
);

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const body = await req.json();
      
      const item = await (prisma as Record<string, any>).mciIncident.create({
        data: {
          tenantId,
          triggerType: body.triggerType,
          level: body.level,
          status: body.status,
          description: body.description,
          commandStructure: body.commandStructure,
          surgeCapacity: body.surgeCapacity,
          activatedAt: body.activatedAt,
          activatedByUserId: userId,
          createdByUserId: userId,
        },
      });

      await createAuditLog(
        'mci_incident',
        item.id,
        'MCI_INCIDENT_CREATED',
        userId || 'system',
        undefined,
        { incidentType: body.incidentType, status: 'ACTIVE' },
        tenantId
      );

      return NextResponse.json({ item }, { status: 201 });
    } catch (e) {
      logger.error('[MCIINCIDENT POST] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.mci.edit' }
);
