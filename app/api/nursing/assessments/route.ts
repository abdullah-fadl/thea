import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const nursingAssessmentSchema = z.object({
  patientId: z.string().min(1),
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  type: z.string().min(1, 'type is required'),
  vitalSigns: z.record(z.string(), z.any()).optional(),
  painLevel: z.number().min(0).max(10).optional(),
  fallRisk: z.string().optional(),
  pressureUlcerRisk: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/nursing/assessments
 * Create a nursing assessment for a patient encounter.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, nursingAssessmentSchema);
    if ('error' in v) return v.error;
    const { patientId, encounterCoreId, type, vitalSigns, painLevel, fallRisk, pressureUlcerRisk, notes } = v.data;

    // Validate patient exists
    const patient = await prisma.patientMaster.findFirst({
      where: { id: patientId, tenantId },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found', errorAr: 'المريض غير موجود' },
        { status: 404 }
      );
    }

    // Validate encounter exists
    const encounter = await prisma.encounterCore.findFirst({
      where: { id: encounterCoreId, tenantId },
    });

    if (!encounter) {
      return NextResponse.json(
        { error: 'Encounter not found', errorAr: 'الزيارة غير موجودة' },
        { status: 404 }
      );
    }

    // Build the assessment metadata
    const metadata = {
      type,
      vitalSigns: vitalSigns || null,
      painLevel: painLevel ?? null,
      fallRisk: fallRisk || null,
      pressureUlcerRisk: pressureUlcerRisk || null,
    };

    // Create via ClinicalNote with noteType NURSING_ASSESSMENT
    const assessment = await prisma.clinicalNote.create({
      data: {
        tenantId,
        patientMasterId: patientId,
        encounterCoreId,
        noteType: 'NURSING_ASSESSMENT',
        title: `Nursing Assessment - ${type}`,
        content: notes || null,
        metadata: metadata as any,
        context: 'nursing',
        area: 'nursing',
        role: 'nurse',
        author: {
          userId,
          name: (user as unknown as Record<string, unknown>)?.name || (user as unknown as Record<string, unknown>)?.email || userId,
          role: (user as unknown as Record<string, unknown>)?.role || 'nurse',
        } as any,
        createdByUserId: userId,
      },
    });

    // Create audit log
    await createAuditLog(
      'ClinicalNote',
      assessment.id,
      'NURSING_ASSESSMENT_CREATED',
      userId,
      (user as unknown as Record<string, unknown>)?.email as string,
      {
        assessmentId: assessment.id,
        patientId,
        encounterCoreId,
        type,
        painLevel: painLevel ?? null,
        fallRisk: fallRisk || null,
        pressureUlcerRisk: pressureUlcerRisk || null,
        hasVitalSigns: !!vitalSigns,
      },
      tenantId,
      req
    );

    return NextResponse.json({
      success: true,
      message: 'Nursing assessment created successfully',
      messageAr: 'تم إنشاء تقييم التمريض بنجاح',
      assessment,
    });
  }),
  { tenantScoped: true, permissionKey: 'nursing.assessments.create' }
);
