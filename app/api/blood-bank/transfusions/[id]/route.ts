import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/blood-bank/transfusions/[id]
 * Get a transfusion with its associated reaction (if any).
 */
export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }, params) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const transfusion = await prisma.transfusion.findFirst({
      where: { id, tenantId },
    });

    if (!transfusion) {
      return NextResponse.json({ error: 'Transfusion not found' }, { status: 404 });
    }

    const reaction = await prisma.transfusionReaction.findFirst({
      where: { transfusionId: id, tenantId },
    });

    return NextResponse.json({ transfusion, reaction: reaction || null });
  }),
  { permissionKey: 'blood_bank.view' }
);

/**
 * PUT /api/blood-bank/transfusions/[id]
 * Update a transfusion.
 */
export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json();
    const { monitoringEntry, endTime, status, postVitals, stoppedReason, rate } = body;

    const transfusion = await prisma.transfusion.findFirst({
      where: { id, tenantId },
    });

    if (!transfusion) {
      return NextResponse.json({ error: 'Transfusion not found' }, { status: 404 });
    }

    const updateData: any = { updatedAt: new Date() };

    if (rate !== undefined) updateData.rate = rate;
    if (postVitals !== undefined) updateData.postVitals = postVitals;
    if (stoppedReason !== undefined) updateData.stoppedReason = stoppedReason;
    if (status !== undefined) updateData.status = status;

    if (monitoringEntry) {
      const existingLog = Array.isArray(transfusion.monitoringLog) ? transfusion.monitoringLog : [];
      updateData.monitoringLog = [
        ...existingLog,
        { ...monitoringEntry, timestamp: new Date().toISOString() },
      ];
    }

    if (endTime) {
      updateData.endTime = new Date(endTime);
    }
    if (status === 'COMPLETED' || status === 'STOPPED') {
      if (!updateData.endTime) updateData.endTime = new Date();

      await prisma.bloodUnit.updateMany({
        where: { unitNumber: transfusion.unitNumber, tenantId },
        data: { status: 'USED' },
      });

      if (status === 'COMPLETED') {
        await prisma.bloodBankRequest.update({
          where: { id: transfusion.requestId },
          data: { status: 'COMPLETED' },
        });
      }
    }

    const updated = await prisma.transfusion.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ transfusion: updated });
  }),
  { permissionKey: 'blood_bank.transfuse' }
);
