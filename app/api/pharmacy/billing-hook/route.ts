import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { createAuditLog } from '@/lib/utils/audit';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const billingHookSchema = z.object({
  prescriptionId: z.string().min(1, 'prescriptionId is required'),
}).passthrough();

/**
 * POST /api/pharmacy/billing-hook
 *
 * Creates a billing charge event when a medication is dispensed.
 * Looks up the prescription and medication catalog to determine pricing,
 * then creates a charge event linked to the patient encounter.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, billingHookSchema);
    if ('error' in v) return v.error;

    const { prescriptionId } = v.data;

    // Fetch the prescription
    const prescription = await prisma.pharmacyPrescription.findFirst({
      where: { tenantId, id: prescriptionId },
    });

    if (!prescription) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
    }

    const rxData = prescription;

    // Only create billing for dispensed prescriptions
    if (rxData.status !== 'DISPENSED' && rxData.status !== 'VERIFIED') {
      return NextResponse.json(
        { error: `Prescription must be DISPENSED or VERIFIED to bill. Current status: ${rxData.status}` },
        { status: 400 }
      );
    }

    // Try to find matching encounter
    const encounterId = rxData.encounterId || null;
    let encounter: { id: string; patientId: string; [key: string]: unknown } | null = null;
    if (encounterId) {
      encounter = await prisma.encounterCore.findFirst({
        where: { tenantId, id: encounterId },
      });
    }

    // Look up medication in the medication catalog for pricing
    let unitPrice = 0;
    let catalogId: string | null = null;
    let catalogCode: string | null = null;
    let catalogName: string | null = null;

    const medicationName = rxData.medication || '';
    const genericName = rxData.genericName || '';

    // Search medication catalog by name or generic name
    const medCatalog = await prisma.medicationCatalog.findFirst({
      where: {
        tenantId,
        OR: [
          { genericName: { contains: medicationName, mode: 'insensitive' } },
          ...(genericName ? [{ genericName: { contains: genericName, mode: 'insensitive' as const } }] : []),
        ],
        status: 'ACTIVE',
      },
    });

    if (medCatalog) {
      // Look up pricing from linked charge catalog
      const linkedCharge = await prisma.billingChargeCatalog.findFirst({
        where: { tenantId, id: medCatalog.chargeCatalogId },
      });
      unitPrice = Number(linkedCharge?.basePrice || 0);
      catalogId = medCatalog.id;
      catalogCode = medCatalog.code || null;
      catalogName = medCatalog.genericName || medicationName;
    } else {
      // Fallback: search in the general charge catalog
      const chargeCatalog = await prisma.billingChargeCatalog.findFirst({
        where: {
          tenantId,
          OR: [
            { name: { contains: medicationName, mode: 'insensitive' } },
            ...(genericName ? [{ name: { contains: genericName, mode: 'insensitive' as const } }] : []),
          ],
          status: 'ACTIVE',
        },
      });
      if (chargeCatalog) {
        unitPrice = Number(chargeCatalog.basePrice || 0);
        catalogId = chargeCatalog.id;
        catalogCode = chargeCatalog.code || null;
        catalogName = chargeCatalog.name || medicationName;
      }
    }

    const quantity = Number(rxData.quantity || 1);
    const totalPrice = Number((quantity * unitPrice).toFixed(2));
    const now = new Date();

    // Check for duplicate charge (idempotency)
    const idempotencyKey = `pharmacy-rx-${prescriptionId}`;
    const existingCharge = await prisma.billingChargeEvent.findFirst({
      where: { tenantId, idempotencyKey },
    });

    if (existingCharge) {
      return NextResponse.json({
        success: true,
        chargeEvent: existingCharge,
        noOp: true,
        message: 'Charge event already exists for this prescription',
      });
    }

    const chargeEvent = {
      id: uuidv4(),
      tenantId,
      encounterCoreId: encounterId || null,
      patientMasterId: rxData.patientId || encounter?.patientId || null,
      departmentKey: 'PHARMACY',
      source: {
        type: 'PHARMACY',
        prescriptionId,
        medication: medicationName,
      },
      chargeCatalogId: catalogId,
      code: catalogCode || `RX-${prescriptionId.slice(0, 8)}`,
      name: catalogName || medicationName,
      unitType: rxData.form || 'unit',
      quantity,
      unitPrice,
      totalPrice,
      payerType: 'PENDING',
      status: 'ACTIVE',
      reason: `Pharmacy dispensation: ${medicationName} ${rxData.strength || ''} x${quantity}`,
      createdAt: now,
      createdBy: userId || null,
      idempotencyKey,
    };

    try {
      await prisma.billingChargeEvent.create({ data: chargeEvent });
    } catch (err: unknown) {
      // Handle unique constraint (P2002) gracefully
      if (err instanceof Error && 'code' in err && (err as Record<string, unknown>).code === 'P2002') {
        const existing = await prisma.billingChargeEvent.findFirst({
          where: { tenantId, idempotencyKey },
        });
        if (existing) {
          return NextResponse.json({ success: true, chargeEvent: existing, noOp: true });
        }
      }
      throw err;
    }

    // Audit trail
    await createAuditLog(
      'BillingChargeEvent',
      chargeEvent.id,
      'PHARMACY_BILLING_CHARGE_CREATED',
      userId,
      user?.email,
      {
        prescriptionId,
        medication: medicationName,
        quantity,
        unitPrice,
        totalPrice,
        encounterId: encounterId || null,
      },
      tenantId,
      req
    );

    logger.info('Pharmacy billing charge created', {
      category: 'api',
      tenantId,
      userId,
      route: '/api/pharmacy/billing-hook',
      prescriptionId,
      chargeEventId: chargeEvent.id,
      totalPrice,
    });

    return NextResponse.json({
      success: true,
      chargeEvent,
    });
  }),
  { tenantScoped: true, permissionKey: 'pharmacy.view' }
);
