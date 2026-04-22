import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }, params: Record<string, string>) => {
    try {
      const itemId = Object.values(params)[0];
      const body = await req.json().catch(() => ({}));
      const item = await prisma.telePrescription.update({
        where: { id: itemId, tenantId },
        data: { status: "SENT_TO_PATIENT", sentToPatientAt: new Date(), ...body },
      });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[TELEPRESCRIPTION SEND] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
    }
  },
  { permissionKey: 'telemedicine.prescriptions.edit' }
);
