import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

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
      const incidentId = url.pathname.split('/').find((_, i, a) => a[i-1] === 'mci' && a[i+1] === 'patients'); if (incidentId) where.incidentId = incidentId;
      const items = await (prisma as Record<string, any>).mciPatient.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return NextResponse.json({ items });
    } catch (e) {
      logger.error('[MCIPATIENT GET] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.mci.view' }
);

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const body = await req.json();
      
      const item = await (prisma as Record<string, any>).mciPatient.create({
        data: {
          tenantId,
          incidentId: body.incidentId,
          patientId: body.patientId,
          triageTag: body.triageTag,
          tagNumber: body.tagNumber,
          name: body.name,
          estimatedAge: body.estimatedAge,
          gender: body.gender,
          chiefComplaint: body.chiefComplaint,
          triageNotes: body.triageNotes,
          disposition: body.disposition,
          arrivedAt: body.arrivedAt,
          createdByUserId: userId,
        },
      });
      return NextResponse.json({ item }, { status: 201 });
    } catch (e) {
      logger.error('[MCIPATIENT POST] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.mci.edit' }
);
