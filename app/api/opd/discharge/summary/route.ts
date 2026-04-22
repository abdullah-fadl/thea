import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { createAuditLog } from '@/lib/utils/audit';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const dischargeSummarySchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  diagnosis: z.array(z.object({
    code: z.string().optional(),
    description: z.string().min(1),
    descriptionAr: z.string().optional(),
    type: z.enum(['PRIMARY', 'SECONDARY', 'ADMITTING']).optional(),
  })).min(1, 'At least one diagnosis is required'),
  medications: z.array(z.object({
    name: z.string().min(1),
    dose: z.string().optional(),
    frequency: z.string().optional(),
    route: z.string().optional(),
    duration: z.string().optional(),
    instructions: z.string().optional(),
    instructionsAr: z.string().optional(),
  })).optional().default([]),
  followUp: z.object({
    date: z.string().optional(),
    provider: z.string().optional(),
    clinic: z.string().optional(),
    instructions: z.string().optional(),
    instructionsAr: z.string().optional(),
  }).optional(),
  instructions: z.object({
    general: z.string().optional(),
    generalAr: z.string().optional(),
    diet: z.string().optional(),
    dietAr: z.string().optional(),
    activity: z.string().optional(),
    activityAr: z.string().optional(),
    warningSigns: z.string().optional(),
    warningSignsAr: z.string().optional(),
  }).optional(),
  procedures: z.array(z.object({
    name: z.string().min(1),
    date: z.string().optional(),
    notes: z.string().optional(),
  })).optional().default([]),
  conditionAtDischarge: z.string().optional(),
  conditionAtDischargeAr: z.string().optional(),
});

/**
 * POST /api/opd/discharge/summary
 * Generate a discharge summary for an OPD encounter.
 * Aggregates diagnosis, medications, follow-up, and patient instructions.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, dischargeSummarySchema);
    if ('error' in v) return v.error;

    const {
      encounterCoreId,
      diagnosis,
      medications,
      followUp,
      instructions,
      procedures,
      conditionAtDischarge,
      conditionAtDischargeAr,
    } = v.data;

    // Validate encounter
    const encounter = await prisma.encounterCore.findFirst({
      where: { id: encounterCoreId, tenantId },
    });
    if (!encounter) {
      return NextResponse.json(
        { error: 'Encounter not found', errorAr: 'الزيارة غير موجودة' },
        { status: 404 }
      );
    }

    // Fetch patient info
    const patient = encounter.patientId
      ? await prisma.patientMaster.findFirst({
          where: { id: encounter.patientId, tenantId },
          select: {
            id: true,
            fullName: true,
            firstName: true,
            lastName: true,
            dob: true,
            gender: true,
            mrn: true,
          },
        })
      : null;

    // Fetch OPD encounter details
    const opd = await prisma.opdEncounter.findFirst({
      where: { encounterCoreId, tenantId },
    });

    // Fetch existing visit notes for context
    const visitNotes = await prisma.opdVisitNote.findMany({
      where: { encounterCoreId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const now = new Date();
    const summary = {
      tenantId,
      encounterCoreId,
      sourceSystem: 'OPD',
      generatedAt: now,
      generatedBy: userId || null,
      generatedByName: user?.displayName || user?.email || null,
      patient: patient
        ? {
            id: patient.id,
            fullName: patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
            dob: patient.dob,
            gender: patient.gender,
            mrn: patient.mrn || null,
          }
        : null,
      encounter: {
        id: encounterCoreId,
        type: encounter.encounterType,
        startedAt: encounter.createdAt,
        visitType: opd?.visitType || null,
      },
      diagnosis,
      medications,
      followUp: followUp || null,
      instructions: instructions || null,
      procedures,
      conditionAtDischarge: conditionAtDischarge || null,
      conditionAtDischargeAr: conditionAtDischargeAr || null,
      visitNotesSummary: visitNotes.map((vn: any) => ({
        chiefComplaint: vn.chiefComplaint,
        assessment: vn.assessment,
        plan: vn.plan,
        diagnoses: vn.diagnoses,
        status: vn.status,
        createdAt: vn.createdAt,
      })),
    };

    // Store the discharge summary
    const stored = await prisma.dischargeSummary.create({
      data: {
        tenantId,
        encounterCoreId,
        sourceSystem: 'OPD',
        disposition: 'HOME',
        summaryText: JSON.stringify(summary),
        createdAt: now,
        createdByUserId: userId || null,
      },
    });

    await createAuditLog(
      'discharge_summary',
      stored.id,
      'OPD_DISCHARGE_SUMMARY_GENERATED',
      userId || 'system',
      user?.email,
      { encounterCoreId, diagnosisCount: diagnosis.length, medicationCount: medications.length },
      tenantId
    );

    logger.info('OPD discharge summary generated', {
      category: 'api',
      tenantId,
      userId,
      route: '/api/opd/discharge/summary',
      encounterCoreId,
    });

    return NextResponse.json({ success: true, summary, id: stored.id });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.edit' }
);
