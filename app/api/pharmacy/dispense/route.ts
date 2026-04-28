import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { syncDispenseStatusToOrder } from '@/lib/opd/prescriptionBridge';
import { createAuditLog } from '@/lib/utils/audit';

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['VERIFIED', 'CANCELLED'],
  VERIFIED: ['DISPENSED', 'CANCELLED'],
  DISPENSED: ['PICKED_UP'],
};

const dispenseBodySchema = z.object({
  prescriptionId: z.string().min(1, 'prescriptionId is required'),
  action: z.enum(['verify', 'dispense', 'pickup', 'cancel']),
  notes: z.string().optional(),
  cancellationReason: z.string().optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, dispenseBodySchema);
    if ('error' in v) return v.error;
    const { prescriptionId, action, notes, cancellationReason } = v.data;

    const prescription = await prisma.pharmacyPrescription.findFirst({
      where: { tenantId, id: prescriptionId },
    });

    if (!prescription) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
    }

    const currentStatus = prescription.status;
    const actionToStatus: Record<string, string> = {
      verify: 'VERIFIED',
      dispense: 'DISPENSED',
      pickup: 'PICKED_UP',
      cancel: 'CANCELLED',
    };

    const targetStatus = actionToStatus[action];
    const allowed = VALID_TRANSITIONS[currentStatus];

    if (!allowed || !allowed.includes(targetStatus)) {
      return NextResponse.json(
        {
          error: `Cannot transition from ${currentStatus} to ${targetStatus}`,
          currentStatus,
          allowedTransitions: allowed || [],
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const updateFields: any = {
      status: targetStatus,
      updatedAt: now,
    };

    switch (action) {
      case 'verify':
        updateFields.verifiedAt = now;
        updateFields.verifiedBy = userId;
        updateFields.verifierName = user?.displayName || user?.email || null;
        if (notes) updateFields.verificationNotes = notes;
        break;
      case 'dispense':
        updateFields.dispensedAt = now;
        updateFields.dispensedBy = userId;
        updateFields.dispenserName = user?.displayName || user?.email || null;
        if (notes) updateFields.pharmacistNotes = notes;
        break;
      case 'pickup':
        updateFields.pickedUpAt = now;
        updateFields.pickedUpRecordedBy = userId;
        break;
      case 'cancel':
        updateFields.cancelledAt = now;
        updateFields.cancelledBy = userId;
        updateFields.cancellationReason = cancellationReason || notes || null;
        break;
    }

    await prisma.pharmacyPrescription.update({
      where: { id: prescriptionId },
      data: updateFields,
    });

    // If dispensed, deduct from inventory
    if (action === 'dispense' && prescription.medication) {
      const inventoryItem = await prisma.pharmacyInventory.findFirst({
        where: {
          tenantId,
          medicationName: prescription.medication,
          currentStock: { gt: 0 },
        },
      });

      if (inventoryItem) {
        const qty = prescription.quantity || 1;
        const newStock = Math.max(0, inventoryItem.currentStock - qty);
        await prisma.pharmacyInventory.update({
          where: { id: inventoryItem.id },
          data: {
            currentStock: newStock,
            lastUpdated: now,
            status: newStock === 0 ? 'OUT_OF_STOCK' : newStock <= (inventoryItem.minStock || 0) ? 'LOW_STOCK' : 'IN_STOCK',
          },
        });
      }
    }

    // Sync status back to the originating OrdersHub entry (fire-and-forget)
    if (prescription.ordersHubId) {
      syncDispenseStatusToOrder(prisma, tenantId, prescription.ordersHubId, targetStatus).catch(() => {});
    }

    await createAuditLog(
      'pharmacy_prescription',
      prescriptionId,
      `PRESCRIPTION_${targetStatus}`,
      userId || 'system',
      user?.email,
      { prescriptionId, action, fromStatus: currentStatus, toStatus: targetStatus },
      tenantId
    );

    logger.info(`Prescription ${action}`, {
      category: 'api',
      tenantId,
      userId,
      route: '/api/pharmacy/dispense',
      prescriptionId,
      fromStatus: currentStatus,
      toStatus: targetStatus,
    });

    return NextResponse.json({ success: true, status: targetStatus });
  }),
  { tenantScoped: true, permissionKey: 'pharmacy.dispense.create' }
);
