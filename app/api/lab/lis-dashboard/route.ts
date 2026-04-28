import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = req.nextUrl;
      const where: Record<string, unknown> = { tenantId };
      const status = url.searchParams.get('status');
      const patientId = url.searchParams.get('patientId');
      if (status) where.status = status;
      if (patientId) where.patientId = patientId;
      
      const items = await prisma.lisConnectionStatus.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return NextResponse.json({ items });
    } catch (e) {
      logger.error('[LISCONNECTIONSTATUS GET] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
  },
  { permissionKey: 'lab.lis-dashboard.view' }
);

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const body = await req.json();
      
      const item = await prisma.lisConnectionStatus.create({
        data: { tenantId, ...body, createdByUserId: userId },
      });
      return NextResponse.json({ item }, { status: 201 });
    } catch (e) {
      logger.error('[LISCONNECTIONSTATUS POST] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
    }
  },
  { permissionKey: 'lab.lis-dashboard.view' }
);
