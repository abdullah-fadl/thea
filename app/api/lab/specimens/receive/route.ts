import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const receiveSpecimenSchema = z.object({
  specimenId: z.string().min(1, 'specimenId is required'),
  receivedByUserId: z.string().min(1, 'receivedByUserId is required'),
  notes: z.string().optional(),
});

/**
 * POST /api/lab/specimens/receive
 * Receive / accession a lab specimen — updates status to RECEIVED with receivedAt timestamp.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, receiveSpecimenSchema);
    if ('error' in v) return v.error;
    const { specimenId, receivedByUserId, notes } = v.data;

    // Find the specimen
    const specimen = await prisma.labSpecimen.findFirst({
      where: { id: specimenId, tenantId },
    });

    if (!specimen) {
      return NextResponse.json(
        { error: 'Specimen not found', errorAr: 'العينة غير موجودة' },
        { status: 404 }
      );
    }

    if (specimen.status === 'RECEIVED') {
      return NextResponse.json(
        { error: 'Specimen already received', errorAr: 'تم استلام العينة مسبقا' },
        { status: 409 }
      );
    }

    const now = new Date();

    // Update specimen status to RECEIVED
    const updated = await prisma.labSpecimen.update({
      where: { id: specimenId },
      data: {
        status: 'RECEIVED',
      },
    });

    // Also update the corresponding lab order if exists
    const orderId = specimen.orderId;
    if (orderId) {
      await prisma.labOrder.updateMany({
        where: { id: orderId, tenantId },
        data: {
          status: 'RECEIVED',
          updatedAt: now,
        },
      }).catch(() => {});

      // Update ordersHub as well for consistency
      await prisma.ordersHub.updateMany({
        where: { id: orderId, tenantId },
        data: {
          status: 'RECEIVED',
          updatedAt: now,
        },
      }).catch(() => {});
    }

    // Create audit log
    await createAuditLog(
      'LabSpecimen',
      specimenId,
      'SPECIMEN_RECEIVED',
      userId,
      user?.email,
      {
        specimenId,
        previousStatus: specimen.status,
        newStatus: 'RECEIVED',
        receivedByUserId,
        receivedAt: now.toISOString(),
        notes: notes || null,
      },
      tenantId,
      req
    );

    return NextResponse.json({
      success: true,
      message: 'Specimen received successfully',
      messageAr: 'تم استلام العينة بنجاح',
      specimen: updated,
    });
  }),
  { tenantScoped: true, permissionKey: 'lab.specimens.create' }
);
