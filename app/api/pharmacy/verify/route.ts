import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { checkDrugInteractions } from '@/lib/pharmacy/drugInteractions';
import { createAuditLog } from '@/lib/utils/audit';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const verifySchema = z.object({
  prescriptionId: z.string().min(1, 'prescriptionId is required'),
  action: z.enum(['verify', 'reject']),
  notes: z.string().optional(),
  overriddenInteractions: z.array(z.string()).optional(),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, verifySchema);
    if ('error' in v) return v.error;

    const { prescriptionId, action, notes, overriddenInteractions } = v.data;

    // Fetch the prescription
    const prescription = await prisma.pharmacyPrescription.findFirst({
      where: { tenantId, id: prescriptionId },
    });

    if (!prescription) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
    }

    const currentStatus = prescription.status;

    if (currentStatus !== 'PENDING') {
      return NextResponse.json(
        {
          error: `Prescription is not pending. Current status: ${currentStatus}`,
          currentStatus,
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const updateFields: any = { updatedAt: now };

    if (action === 'verify') {
      // Re-check drug interactions at verification time
      const drugName = prescription.genericName || prescription.medication;
      const mrn = prescription.mrn;
      let interactionWarning: string | null = null;

      if (drugName && mrn) {
        try {
          const activePrescriptions = await prisma.pharmacyPrescription.findMany({
            where: {
              tenantId,
              mrn,
              status: { in: ['VERIFIED', 'DISPENSED'] },
              id: { not: prescriptionId },
            },
            select: { genericName: true, medication: true },
            take: 100,
          });

          const currentMedications = activePrescriptions.map(
            (p: { genericName?: string | null; medication: string }) =>
              (p.genericName || p.medication).trim()
          );

          if (currentMedications.length > 0) {
            const interactions = checkDrugInteractions(drugName, currentMedications);
            const hasCritical = interactions.some((i) => i.severity === 'critical');
            const hasMajor = interactions.some((i) => i.severity === 'major');

            if ((hasCritical || hasMajor) && (!overriddenInteractions || overriddenInteractions.length === 0)) {
              return NextResponse.json(
                {
                  error: 'Critical or major drug interactions detected. Override required.',
                  interactions: interactions
                    .filter((i) => i.severity === 'critical' || i.severity === 'major')
                    .map((i) => ({
                      severity: i.severity,
                      drug1: i.interaction?.drug1,
                      drug2: i.interaction?.drug2,
                      description: i.interaction?.description,
                    })),
                },
                { status: 409 }
              );
            }

            if (interactions.length > 0) {
              interactionWarning = `${interactions.length} interaction(s) detected: ${interactions
                .map((i) => `${i.severity}: ${i.interaction?.drug1 || ''} + ${i.interaction?.drug2 || ''}`)
                .join('; ')}`;
            }
          }
        } catch (err) {
          // Non-blocking: if drug interaction check fails, log and continue
          logger.warn('Drug interaction check failed during verification', {
            category: 'api',
            tenantId,
            prescriptionId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      updateFields.status = 'VERIFIED';
      updateFields.verifiedAt = now;
      updateFields.verifiedBy = userId;
      updateFields.verifierName = user?.displayName || user?.email || null;
      if (notes) updateFields.verificationNotes = notes;
      if (overriddenInteractions && overriddenInteractions.length > 0) {
        updateFields.overriddenInteractions = JSON.stringify(overriddenInteractions);
      }
      if (interactionWarning) {
        updateFields.interactionWarning = interactionWarning;
      }
    } else {
      // Reject
      updateFields.status = 'REJECTED';
      updateFields.rejectedAt = now;
      updateFields.rejectedBy = userId;
      updateFields.rejectionReason = notes || 'No reason provided';
    }

    await prisma.pharmacyPrescription.update({
      where: { id: prescriptionId },
      data: updateFields,
    });

    // Audit trail
    const auditAction = action === 'verify' ? 'PHARMACY_PRESCRIPTION_VERIFIED' : 'PHARMACY_PRESCRIPTION_REJECTED';
    await createAuditLog(
      'PharmacyPrescription',
      prescriptionId,
      auditAction,
      userId,
      user?.email,
      {
        action,
        fromStatus: currentStatus,
        toStatus: action === 'verify' ? 'VERIFIED' : 'REJECTED',
        notes: notes || null,
        overriddenInteractions: overriddenInteractions || [],
        medication: prescription.medication,
        patientName: prescription.patientName,
        mrn: prescription.mrn,
      },
      tenantId,
      req
    );

    logger.info(`Prescription ${action}`, {
      category: 'api',
      tenantId,
      userId,
      route: '/api/pharmacy/verify',
      prescriptionId,
      action,
      fromStatus: currentStatus,
      toStatus: action === 'verify' ? 'VERIFIED' : 'REJECTED',
    });

    return NextResponse.json({
      success: true,
      status: action === 'verify' ? 'VERIFIED' : 'REJECTED',
    });
  }),
  { tenantScoped: true, permissionKey: 'pharmacy.view' }
);
