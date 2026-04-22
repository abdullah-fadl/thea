import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { checkDrugAllergy, PatientAllergy } from '@/lib/clinical/allergyCheck';
import { createAuditLog } from '@/lib/utils/audit';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const allergyCheckSchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  medications: z.array(z.object({
    name: z.string().min(1),
    id: z.string().optional(),
  })).min(1, 'At least one medication is required'),
});

/**
 * POST /api/clinical/allergies/check
 * Check if medications conflict with a patient's known allergies.
 * Returns alerts with severity for each conflicting medication.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, allergyCheckSchema);
    if ('error' in v) return v.error;

    const { patientId, medications } = v.data;

    // Fetch patient
    const patient = await prisma.patientMaster.findFirst({
      where: { id: patientId, tenantId },
      select: { id: true, knownAllergies: true },
    });
    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found', errorAr: 'المريض غير موجود' },
        { status: 404 }
      );
    }

    // Fetch structured allergies from allergy table
    const patientAllergies = await prisma.patientAllergy.findMany({
      where: { patientId, tenantId, status: 'ACTIVE' },
    });

    // Check for NKDA
    const nkda = patientAllergies.some((a: any) => a.nkda === true);
    if (nkda && patientAllergies.length === 1) {
      return NextResponse.json({
        nkda: true,
        hasAlerts: false,
        alerts: [],
        message: 'No known drug allergies',
        messageAr: 'لا توجد حساسية دوائية معروفة',
      });
    }

    // Combine known allergies from JSON field and structured records
    const knownAllergyList = Array.isArray(patient.knownAllergies)
      ? (patient.knownAllergies as Record<string, unknown>[])
      : [];

    const allergies: PatientAllergy[] = [
      ...knownAllergyList.map((a: any) => ({
        allergen: typeof a === 'string' ? a : a.allergen || a.name,
        reaction: a.reaction,
        severity: a.severity,
      })),
      ...patientAllergies
        .filter((a: any) => a.nkda !== true)
        .map((a) => ({
          allergen: a.allergen,
          reaction: a.reaction || undefined,
          severity: a.severity || undefined,
        })),
    ];

    const alerts: Array<{
      medication: string;
      medicationId?: string;
      hasConflict: boolean;
      matchedAllergen: string | null;
      severity: string;
      reaction: string | null;
      recommendation: string;
      recommendationAr: string;
    }> = [];

    for (const med of medications) {
      const result = checkDrugAllergy(med.name, allergies);
      if (!result.safe && result.alerts.length > 0) {
        for (const alert of result.alerts) {
          alerts.push({
            medication: med.name,
            medicationId: med.id,
            hasConflict: true,
            matchedAllergen: alert.allergen || null,
            severity: alert.severity || 'HIGH',
            reaction: alert.message || null,
            recommendation: alert.recommendation || `Patient has a known allergy to ${alert.allergen}. Consider alternative medication.`,
            recommendationAr: alert.recommendationAr || `المريض لديه حساسية معروفة تجاه ${alert.allergen}. يرجى النظر في بديل.`,
          });
        }
      }
    }

    if (alerts.length > 0) {
      logger.warn('Allergy conflict detected', {
        category: 'api',
        tenantId,
        userId,
        route: '/api/clinical/allergies/check',
        patientId,
        alertCount: alerts.length,
      });

      await createAuditLog(
        'allergy_check',
        patientId,
        'ALLERGY_CONFLICT_DETECTED',
        userId || 'system',
        undefined,
        { patientId, medications: medications.map((m) => m.name), alertCount: alerts.length },
        tenantId
      );
    }

    return NextResponse.json({
      nkda: false,
      hasAlerts: alerts.length > 0,
      alerts,
      totalChecked: medications.length,
      totalConflicts: alerts.length,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical.prescribe' }
);
