import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }, params: Record<string, string>) => {
    try {
      const readingId = params.readingId;

      const reading = await prisma.rpmReading.findFirst({
        where: { id: readingId, tenantId },
      });

      if (!reading) {
        return NextResponse.json({ error: 'Reading not found' }, { status: 404 });
      }

      if (reading.alertAckedAt) {
        return NextResponse.json({ error: 'Already acknowledged' }, { status: 400 });
      }

      const updated = await prisma.rpmReading.update({
        where: { id: readingId },
        data: {
          alertAckedBy: userId,
          alertAckedAt: new Date(),
        },
      });

      return NextResponse.json({ reading: updated });
    } catch (e) {
      logger.error('[RPM READING ACK] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to acknowledge' }, { status: 500 });
    }
  },
  { permissionKey: 'telemedicine.rpm.edit' }
);
