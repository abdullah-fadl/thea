import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { checkDrugInteractions } from '@/lib/pharmacy/drugInteractions';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const checkInteractionsSchema = z
  .object({
    /** The medication being prescribed or dispensed */
    newDrug: z.string().min(1, 'newDrug is required'),
    /** Current medications the patient is on — provide these directly OR patientMrn */
    currentMedications: z.array(z.string()).optional(),
    /** Patient MRN — if provided, active dispensed prescriptions are auto-fetched */
    patientMrn: z.string().optional(),
    /** Exclude a specific prescription ID from the current-medications lookup (the one being checked) */
    excludeId: z.string().optional(),
  })
  .refine((d) => (d.currentMedications && d.currentMedications.length > 0) || d.patientMrn, {
    message: 'Either currentMedications or patientMrn must be provided',
  });

/**
 * POST /api/pharmacy/drug-interactions
 *
 * Check a new medication against the patient's current medication list.
 * Returns any known interactions with severity and recommendations.
 *
 * Accepts either:
 *  - { newDrug, currentMedications: string[] }  — explicit list
 *  - { newDrug, patientMrn }                     — auto-lookup from active prescriptions
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, checkInteractionsSchema);
    if ('error' in v) return v.error;

    const { newDrug, currentMedications: explicitMeds, patientMrn, excludeId } = v.data;

    let currentMedications: string[] = explicitMeds ?? [];

    // Auto-lookup from dispensed/verified prescriptions if patientMrn provided
    if (patientMrn && currentMedications.length === 0) {
      const activePrescriptions = await prisma.pharmacyPrescription.findMany({
        where: {
          tenantId,
          mrn: patientMrn,
          status: { in: ['VERIFIED', 'DISPENSED'] },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { genericName: true, medication: true },
        take: 100,
      });

      currentMedications = activePrescriptions.map(
        (p: { genericName?: string | null; medication: string }) =>
          (p.genericName || p.medication).trim()
      );
    }

    const interactions = checkDrugInteractions(newDrug, currentMedications);

    const hasCritical = interactions.some((i) => i.severity === 'critical');
    const hasMajor = interactions.some((i) => i.severity === 'major');

    if (hasCritical || hasMajor) {
      logger.warn('Drug interaction detected', {
        category: 'api',
        tenantId,
        userId,
        route: '/api/pharmacy/drug-interactions',
        newDrug,
        currentMedications,
        interactionCount: interactions.length,
        hasCritical,
        hasMajor,
      });
    }

    return NextResponse.json({
      newDrug,
      currentMedications,
      interactions: interactions.map((i) => ({
        severity: i.severity,
        drug1: i.interaction?.drug1,
        drug2: i.interaction?.drug2,
        description: i.interaction?.description,
        recommendation: i.interaction?.recommendation,
      })),
      summary: {
        total: interactions.length,
        critical: interactions.filter((i) => i.severity === 'critical').length,
        major: interactions.filter((i) => i.severity === 'major').length,
        minor: interactions.filter((i) => i.severity === 'minor').length,
        overallSeverity: hasCritical
          ? 'critical'
          : hasMajor
          ? 'major'
          : interactions.length > 0
          ? 'minor'
          : 'none',
      },
    });
  }),
  { tenantScoped: true, permissionKey: 'pharmacy.dispensing.view' }
);
