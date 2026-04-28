import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

const STEP_ORDER = ['PREREQUISITES', 'EXAM1', 'WAITING', 'EXAM2', 'CONFIRMATORY', 'DECLARED'] as const;

function nextStep(current: string): string | null {
  const idx = STEP_ORDER.indexOf(current as typeof STEP_ORDER[number]);
  if (idx === -1 || idx >= STEP_ORDER.length - 1) return null;
  return STEP_ORDER[idx + 1];
}

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }, params: Record<string, string>) => {
    try {
      const protocolId = params.id;
      const body = await req.json();

      const protocol = await (prisma as Record<string, unknown> & typeof prisma).brainDeathProtocol.findFirst({
        where: { id: protocolId, tenantId },
      });

      if (!protocol) {
        return NextResponse.json({ error: 'Protocol not found' }, { status: 404 });
      }

      const currentStatus = (protocol as Record<string, unknown>).status as string;
      const next = nextStep(currentStatus);
      if (!next) {
        return NextResponse.json({ error: 'Protocol already at final step or invalid status' }, { status: 400 });
      }

      const updateData: Record<string, unknown> = { status: next, ...body };

      if (next === 'DECLARED') {
        updateData.declaredAt = new Date();
        updateData.declaredByUserId = userId;
      }

      const updated = await (prisma as Record<string, unknown> & typeof prisma).brainDeathProtocol.update({
        where: { id: protocolId },
        data: updateData,
      });

      return NextResponse.json({ protocol: updated });
    } catch (e) {
      logger.error('[BRAIN-DEATH ADVANCE] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to advance' }, { status: 500 });
    }
  },
  { permissionKey: 'icu.brain-death.edit' }
);
