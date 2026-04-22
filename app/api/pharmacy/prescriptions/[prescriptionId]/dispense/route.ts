import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { createAuditLog } from '@/lib/utils/audit';
import { syncDispenseStatusToOrder } from '@/lib/opd/prescriptionBridge';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Valid transitions aligned with the main dispense state machine at /api/pharmacy/dispense.
 * PENDING -> VERIFIED -> DISPENSED -> PICKED_UP
 * This per-prescription route now only handles the DISPENSED transition.
 * For verify/pickup/cancel, use the main /api/pharmacy/dispense route.
 */
const VALID_DISPENSE_STATUSES = ['VERIFIED', 'ACTIVE'] as const;

const dispenseSchema = z.object({
  dispensedByUserId: z.string().min(1, 'dispensedByUserId is required'),
  quantity: z.number().int().positive('quantity must be a positive integer'),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/pharmacy/prescriptions/[prescriptionId]/dispense
 * Confirm dispensing of a prescription -- updates status to DISPENSED.
 * Requires prescription to be VERIFIED or ACTIVE (aligned with main dispense state machine).
 * Also deducts from pharmacy inventory.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
    const resolved = params instanceof Promise ? await params : params;
    const prescriptionId = resolved?.prescriptionId as string;

    if (!prescriptionId) {
      return NextResponse.json(
        { error: 'Prescription ID is required', errorAr: 'معرف الوصفة مطلوب' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, dispenseSchema);
    if ('error' in v) return v.error;
    const { dispensedByUserId, quantity, batchNumber, expiryDate, notes } = v.data;

    // Find the prescription
    const prescription = await prisma.pharmacyPrescription.findFirst({
      where: { id: prescriptionId, tenantId },
    });

    if (!prescription) {
      return NextResponse.json(
        { error: 'Prescription not found', errorAr: 'الوصفة غير موجودة' },
        { status: 404 }
      );
    }

    const currentStatus = prescription.status;

    // [AUDIT FIX] Prevent double-dispense: reject if already dispensed
    if (currentStatus === 'DISPENSED') {
      return NextResponse.json(
        { error: 'Already dispensed', errorAr: 'تم صرف الوصفة مسبقاً' },
        { status: 409 }
      );
    }

    // [P3-EHR-007 FIX] Align with main dispense state machine: only VERIFIED or ACTIVE can be dispensed.
    // PENDING prescriptions must first be verified via /api/pharmacy/dispense { action: 'verify' }.
    if (!(VALID_DISPENSE_STATUSES as readonly string[]).includes(currentStatus)) {
      return NextResponse.json(
        {
          error: `Prescription must be VERIFIED or ACTIVE to dispense (current: ${currentStatus}). Use /api/pharmacy/dispense to verify first.`,
          errorAr: 'يجب التحقق من الوصفة أولاً قبل الصرف',
          currentStatus,
          allowedStatuses: [...VALID_DISPENSE_STATUSES],
        },
        { status: 409 }
      );
    }

    const now = new Date();

    // Update prescription status to DISPENSED
    const updated = await prisma.pharmacyPrescription.update({
      where: { id: prescriptionId },
      data: {
        status: 'DISPENSED',
        dispensedAt: now,
        dispensedBy: dispensedByUserId,
        dispenserName: user?.displayName || user?.email || null,
        pharmacistNotes: notes || undefined,
      },
    });

    // [P3-EHR-008 FIX] Deduct from pharmacy inventory on dispense
    if (prescription.medication) {
      const inventoryItem = await prisma.pharmacyInventory.findFirst({
        where: {
          tenantId,
          medicationName: prescription.medication,
          currentStock: { gt: 0 },
        },
      });

      if (inventoryItem) {
        const qty = quantity || prescription.quantity || 1;
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

    // Sync status back to OrdersHub (consistent with main dispense route)
    if (prescription.ordersHubId) {
      syncDispenseStatusToOrder(prisma, tenantId, prescription.ordersHubId, 'DISPENSED').catch(() => {});
    }

    // Create audit log
    await createAuditLog(
      'pharmacy_prescription',
      prescriptionId,
      'PRESCRIPTION_DISPENSED',
      userId || 'system',
      user?.email,
      {
        prescriptionId,
        previousStatus: currentStatus,
        newStatus: 'DISPENSED',
        dispensedByUserId,
        quantity,
        batchNumber: batchNumber || null,
        expiryDate: expiryDate || null,
        dispensedAt: now.toISOString(),
        notes: notes || null,
      },
      tenantId,
      req
    );

    logger.info('Prescription dispensed (per-prescription route)', {
      category: 'api',
      tenantId,
      userId,
      route: `/api/pharmacy/prescriptions/${prescriptionId}/dispense`,
      prescriptionId,
      fromStatus: currentStatus,
      toStatus: 'DISPENSED',
    });

    return NextResponse.json({
      success: true,
      message: 'Prescription dispensed successfully',
      messageAr: 'تم صرف الوصفة بنجاح',
      prescription: updated,
    });
  }),
  { tenantScoped: true, permissionKey: 'pharmacy.dispense.create' }
);
