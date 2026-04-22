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

const recordVitalsSchema = z.object({
  encounterCoreId: z.string().min(1, 'encounterCoreId is required'),
  patientId: z.string().min(1, 'patientId is required'),
  vitalSigns: z.object({
    temperature: z.number().optional(),
    temperatureUnit: z.enum(['C', 'F']).optional().default('C'),
    heartRate: z.number().optional(),
    respiratoryRate: z.number().optional(),
    bloodPressureSystolic: z.number().optional(),
    bloodPressureDiastolic: z.number().optional(),
    oxygenSaturation: z.number().optional(),
    weight: z.number().optional(),
    weightUnit: z.enum(['kg', 'lb']).optional().default('kg'),
    height: z.number().optional(),
    heightUnit: z.enum(['cm', 'in']).optional().default('cm'),
    painLevel: z.number().min(0).max(10).optional(),
    bloodGlucose: z.number().optional(),
  }),
  notes: z.string().optional(),
  source: z.enum(['MANUAL', 'DEVICE', 'MONITOR']).default('MANUAL'),
});

/**
 * POST /api/opd/nursing/worklist/vitals
 * Record vital signs directly from the nursing worklist context.
 * Creates an OpdNursingEntry with vitals data and optionally a NursingAssessment.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, recordVitalsSchema);
    if ('error' in v) return v.error;

    const { encounterCoreId, patientId, vitalSigns, notes, source } = v.data;

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
    if (encounter.status === 'CLOSED') {
      return NextResponse.json(
        { error: 'Encounter is closed', errorAr: 'الزيارة مغلقة' },
        { status: 409 }
      );
    }

    // Validate patient
    const patient = await prisma.patientMaster.findFirst({
      where: { id: patientId, tenantId },
    });
    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found', errorAr: 'المريض غير موجود' },
        { status: 404 }
      );
    }

    // Check for critical vitals
    const criticalFlags: string[] = [];
    if (vitalSigns.temperature != null) {
      if (vitalSigns.temperatureUnit === 'C' && (vitalSigns.temperature > 39 || vitalSigns.temperature < 35)) {
        criticalFlags.push('temperature');
      }
    }
    if (vitalSigns.heartRate != null && (vitalSigns.heartRate > 120 || vitalSigns.heartRate < 50)) {
      criticalFlags.push('heartRate');
    }
    if (vitalSigns.oxygenSaturation != null && vitalSigns.oxygenSaturation < 90) {
      criticalFlags.push('oxygenSaturation');
    }
    if (vitalSigns.bloodPressureSystolic != null && (vitalSigns.bloodPressureSystolic > 180 || vitalSigns.bloodPressureSystolic < 90)) {
      criticalFlags.push('bloodPressureSystolic');
    }
    if (vitalSigns.respiratoryRate != null && (vitalSigns.respiratoryRate > 30 || vitalSigns.respiratoryRate < 10)) {
      criticalFlags.push('respiratoryRate');
    }

    const now = new Date();
    const hasCritical = criticalFlags.length > 0;

    // Convert vitalSigns to the format expected by the OpdNursingEntry vitals JSON field
    const vitalsJson: Record<string, unknown> = {};
    if (vitalSigns.bloodPressureSystolic != null || vitalSigns.bloodPressureDiastolic != null) {
      vitalsJson.bp = `${vitalSigns.bloodPressureSystolic || ''}/${vitalSigns.bloodPressureDiastolic || ''}`;
    }
    if (vitalSigns.heartRate != null) vitalsJson.hr = vitalSigns.heartRate;
    if (vitalSigns.temperature != null) vitalsJson.temp = vitalSigns.temperature;
    if (vitalSigns.respiratoryRate != null) vitalsJson.rr = vitalSigns.respiratoryRate;
    if (vitalSigns.oxygenSaturation != null) vitalsJson.spo2 = vitalSigns.oxygenSaturation;
    if (vitalSigns.weight != null) vitalsJson.weight = vitalSigns.weight;
    if (vitalSigns.height != null) vitalsJson.height = vitalSigns.height;
    if (vitalSigns.bloodGlucose != null) vitalsJson.bloodGlucose = vitalSigns.bloodGlucose;
    vitalsJson.source = source;
    vitalsJson.criticalFlags = criticalFlags;

    // Create OpdNursingEntry with vitals
    const opd = await prisma.opdEncounter.findFirst({
      where: { encounterCoreId, tenantId },
    });

    let nursingEntry = null;
    if (opd) {
      nursingEntry = await prisma.opdNursingEntry.create({
        data: {
          opdEncounterId: opd.id,
          createdByUserId: userId || null,
          nursingNote: notes || null,
          painScore: vitalSigns.painLevel ?? null,
          vitals: vitalsJson as any,
          createdAt: now,
        },
      });

      // Update critical vitals flag on OPD encounter if critical
      if (hasCritical) {
        await prisma.opdEncounter.update({
          where: { id: opd.id },
          data: {
            criticalVitalsFlag: {
              active: true,
              alerts: criticalFlags,
              detectedAt: now.toISOString(),
              detectedByUserId: userId,
              nursingEntryId: nursingEntry.id,
            },
          },
        });
      }
    }

    // Also create a NursingAssessment record for cross-module compatibility
    await prisma.nursingAssessment.create({
      data: {
        tenantId,
        patientId,
        encounterCoreId,
        type: 'VITALS',
        vitalSigns: vitalSigns as any,
        painLevel: vitalSigns.painLevel ?? null,
        notes: notes || null,
        assessedBy: userId || null,
        assessedByName: user?.displayName || user?.email || null,
        createdAt: now,
        updatedAt: now,
      },
    });

    await createAuditLog(
      'nursing_vitals',
      encounterCoreId,
      hasCritical ? 'CRITICAL_VITALS_RECORDED' : 'VITALS_RECORDED',
      userId || 'system',
      user?.email,
      { encounterCoreId, patientId, vitalSigns, criticalFlags, source },
      tenantId
    );

    if (hasCritical) {
      logger.warn('Critical vitals recorded', {
        category: 'api',
        tenantId,
        userId,
        route: '/api/opd/nursing/worklist/vitals',
        encounterCoreId,
        criticalFlags,
      });
    } else {
      logger.info('Vitals recorded from worklist', {
        category: 'api',
        tenantId,
        userId,
        route: '/api/opd/nursing/worklist/vitals',
        encounterCoreId,
      });
    }

    return NextResponse.json({
      success: true,
      hasCritical,
      criticalFlags,
      vitalSigns,
      nursingEntryId: nursingEntry?.id || null,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.nursing.edit' }
);

/**
 * GET /api/opd/nursing/worklist/vitals?encounterCoreId=xxx
 * Get vitals history for an encounter from the nursing worklist context.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = new URL(req.url);
    const encounterCoreId = String(searchParams.get('encounterCoreId') || '').trim();
    if (!encounterCoreId) {
      return NextResponse.json(
        { error: 'encounterCoreId is required', errorAr: 'معرف الزيارة مطلوب' },
        { status: 400 }
      );
    }

    const opd = await prisma.opdEncounter.findFirst({
      where: { encounterCoreId, tenantId },
      include: {
        nursingEntries: {
          where: { vitals: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    const entries = (opd?.nursingEntries || []).map((entry: any) => ({
      id: entry.id,
      vitalSigns: entry.vitals,
      painScore: entry.painScore,
      notes: entry.nursingNote,
      recordedAt: entry.createdAt,
      recordedBy: entry.createdByUserId,
    }));

    return NextResponse.json({
      encounterCoreId,
      total: entries.length,
      items: entries,
      latestVitals: entries[0]?.vitalSigns || null,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.nursing.view' }
);
