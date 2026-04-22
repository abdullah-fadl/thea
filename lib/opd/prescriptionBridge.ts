// =============================================================================
// Prescription Bridge — NEW FILE (no existing code modified)
// =============================================================================
// Syncs a medication order from OrdersHub → PharmacyPrescription
// Called after a MEDICATION order is created in /api/orders POST.
// Safe to call multiple times (idempotent via ordersHubId check).

import { PrismaClient } from '@prisma/client';

interface BridgeInput {
  order: {
    id: string;
    tenantId: string;
    encounterCoreId: string;
    patientMasterId: string;
    orderCode: string;
    orderName: string;
    priority: string;
    meta: any;
    createdByUserId: string | null;
    createdAt: Date;
  };
  encounter: {
    patientId: string;
    doctorId?: string | null;
    doctorName?: string | null;
    mrn?: string | null;
  };
  patient?: {
    fullName?: string | null;
    mrn?: string | null;
    mobile?: string | null;
  } | null;
  prescribedByUser?: {
    displayName?: string | null;
    email?: string | null;
  } | null;
}

/**
 * Creates a PharmacyPrescription entry from an OrdersHub medication order.
 * Idempotent: if a prescription already exists for this ordersHubId, skips.
 */
export async function bridgeOrderToPharmacy(
  prisma: PrismaClient,
  input: BridgeInput,
): Promise<{ created: boolean; prescriptionId?: string }> {
  const { order, encounter, patient, prescribedByUser } = input;

  // Idempotency check — don't create duplicate
  const existing = await prisma.pharmacyPrescription.findFirst({
    where: { tenantId: order.tenantId, ordersHubId: order.id },
    select: { id: true },
  });

  if (existing) return { created: false, prescriptionId: existing.id };

  const meta = order.meta ?? {};

  const prescription = await prisma.pharmacyPrescription.create({
    data: {
      tenantId: order.tenantId,
      ordersHubId: order.id,
      encounterId: order.encounterCoreId,
      patientId: encounter.patientId,
      patientName: patient?.fullName ?? null,
      mrn: patient?.mrn ?? encounter.mrn ?? null,
      // Medication details from OrdersHub meta
      medication: order.orderName,
      genericName: meta.genericName ?? null,
      strength: meta.strength ?? null,
      form: meta.form ?? null,
      route: meta.route ?? null,
      frequency: meta.frequency ?? null,
      duration: meta.duration ?? null,
      quantity: typeof meta.quantity === 'number' ? meta.quantity : null,
      refills: typeof meta.refills === 'number' ? meta.refills : 0,
      instructions: meta.instructions ?? null,
      priority: order.priority,
      status: 'PENDING',
      prescribedAt: order.createdAt,
      prescribedBy: order.createdByUserId,
      prescriberName:
        prescribedByUser?.displayName ??
        prescribedByUser?.email ??
        (encounter.doctorName ?? null),
      doctorId: encounter.doctorId ?? null,
      doctorName: encounter.doctorName ?? null,
    },
  });

  return { created: true, prescriptionId: prescription.id };
}

/**
 * Syncs pharmacy dispense status back to OrdersHub.
 * Call from /api/pharmacy/dispense after status update.
 * Maps: DISPENSED → COMPLETED, CANCELLED → CANCELLED, VERIFIED → IN_PROGRESS
 */
export async function syncDispenseStatusToOrder(
  prisma: PrismaClient,
  tenantId: string,
  ordersHubId: string,
  pharmacyStatus: string,
): Promise<void> {
  const statusMap: Record<string, string | null> = {
    VERIFIED: 'IN_PROGRESS',
    DISPENSED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
  };

  const newStatus = statusMap[pharmacyStatus];
  if (!newStatus) return; // PENDING / PICKED_UP don't change order status

  const order = await prisma.ordersHub.findFirst({
    where: { tenantId, id: ordersHubId },
    select: { id: true, status: true },
  });

  if (!order) return;

  // Don't downgrade status
  const orderPriority = ['ORDERED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  const current = orderPriority.indexOf(order.status);
  const target = orderPriority.indexOf(newStatus);
  if (target <= current) return;

  const now = new Date();
  await prisma.ordersHub.update({
    where: { id: order.id },
    data: {
      status: newStatus,
      updatedAt: now,
      ...(newStatus === 'COMPLETED' ? { completedAt: now } : {}),
      ...(newStatus === 'CANCELLED' ? { cancelledAt: now } : {}),
      ...(newStatus === 'IN_PROGRESS' ? { inProgressAt: now } : {}),
    },
  });
}
