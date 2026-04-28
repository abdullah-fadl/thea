import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['SCHEDULED', 'WAITING_ROOM', 'IN_CALL', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
type VisitStatus = typeof VALID_STATUSES[number];

function isValidStatus(s: string): s is VisitStatus {
  return (VALID_STATUSES as readonly string[]).includes(s);
}

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }, params: Record<string, string>) => {
    try {
      const visitId = params.visitId;
      const body = await req.json();
      const { status } = body as { status: string };

      if (!status || !isValidStatus(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
          { status: 400 },
        );
      }

      const visit = await prisma.teleVisit.findFirst({
        where: { id: visitId, tenantId },
      });

      if (!visit) {
        return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
      }

      const updateData: Record<string, unknown> = { status };

      if (status === 'COMPLETED' && !visit.endedAt) {
        updateData.endedAt = new Date();
        if (visit.joinedByDoctorAt) {
          updateData.duration = Math.round(
            (Date.now() - new Date(visit.joinedByDoctorAt).getTime()) / 60000,
          );
        }
      }

      const updated = await prisma.teleVisit.update({
        where: { id: visitId },
        data: updateData,
      });

      return NextResponse.json({ visit: updated });
    } catch (e) {
      logger.error('[TELEVISIT STATUS] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }
  },
  { permissionKey: 'telemedicine.visits.edit' }
);
