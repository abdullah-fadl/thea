import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

import { createAuditLog } from '@/lib/utils/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { opdEventBus } from '@/lib/opd/eventBus';
import { type OpdFallRiskLabel, type OpdPriority, Prisma } from '@prisma/client';
import { validateBody } from '@/lib/validation/helpers';
import { opdNursingSchema, opdNursingCorrectionSchema } from '@/lib/validation/opd.schema';
import { vitalsToMEWSInput, calculateMEWS, type ConsciousnessLevel } from '@/lib/clinical/mewsCalculator';
import { calculateGCS, type GCSInput } from '@/lib/clinical/gcsCalculator';
import { calculateBraden, type BradenInput } from '@/lib/clinical/bradenScale';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const resolvedParams = (params && typeof (params as any).then === 'function') ? await params : params;
  const encounterCoreId = String((resolvedParams as any)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const opd = await prisma.opdEncounter.findFirst({
    where: { tenantId, encounterCoreId },
  });
  if (!opd) {
    return NextResponse.json({ error: 'OPD encounter not found' }, { status: 404 });
  }

  const entries = await prisma.opdNursingEntry.findMany({
    where: { opdEncounterId: opd.id, isCorrected: false },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const items = entries.map((e) => ({
    id: e.id,
    nursingNote: e.nursingNote,
    chiefComplaintShort: e.chiefComplaintShort,
    painScore: e.painScore,
    painLocation: e.painLocation,
    fallRiskScore: e.fallRiskScore,
    fallRiskLabel: e.fallRiskLabel,
    fallRiskData: e.fallRiskData,
    vitals: (e.vitals as Record<string, unknown>) || {},
    latestVitals: (e.vitals as Record<string, unknown>) || {},
    consciousness: e.consciousness,
    onSupplementalO2: e.onSupplementalO2,
    mewsScore: e.mewsScore,
    mewsRiskLevel: e.mewsRiskLevel,
    mewsData: e.mewsData,
    gcsScore: e.gcsScore,
    gcsCategory: e.gcsCategory,
    gcsData: e.gcsData,
    sbarData: e.sbarData,
    painData: e.painData,
    familyCommData: e.familyCommData,
    proceduresData: e.proceduresData,
    ioData: e.ioData,
    bradenScore: e.bradenScore,
    bradenRisk: e.bradenRisk,
    bradenData: e.bradenData,
    carePlanData: e.carePlanData,
    handoverData: e.handoverData,
    nursingTasksData: e.nursingTasksData,
    marData: e.marData,
    pfe: e.pfe,
    timeOutChecklist: e.timeOutChecklist,
    createdAt: e.createdAt,
  }));

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKeys: ['opd.visit.view', 'opd.doctor.encounter.view', 'opd.doctor.visit.view', 'opd.nursing.edit'] }
);

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(num) ? null : num;
}

function toText(value: unknown) {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function normalizeFallRisk(input: unknown): { score: number | null; label: OpdFallRiskLabel | null } {
  if (input === null || input === undefined || input === '') return { score: null, label: null };
  const text = String(input).trim().toUpperCase();
  if (['LOW', 'MED', 'HIGH'].includes(text)) {
    return { score: text === 'LOW' ? 0 : text === 'MED' ? 1 : 2, label: text as OpdFallRiskLabel };
  }
  const score = toNumber(input);
  if (score === null) return { score: null, label: null };
  if (score <= 0) return { score: 0, label: 'LOW' };
  if (score === 1) return { score: 1, label: 'MED' };
  return { score: 2, label: 'HIGH' };
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {

  const resolvedParams2 = (params && typeof (params as any).then === 'function') ? await params : params;
  const encounterCoreId = String((resolvedParams2 as any)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
  if (deathGuard) return deathGuard;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = opdNursingSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const firstField = Object.entries(flat.fieldErrors || {}).find(([, v]) => v && v.length);
    const msg = firstField
      ? `${firstField[0]}: ${(firstField[1] as string[])?.[0] || 'invalid'}`
      : (flat.formErrors?.[0] as string) || 'Validation failed';
    return NextResponse.json(
      { error: msg, details: flat },
      { status: 400 }
    );
  }

  const encounterCore = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounterCore) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  if (encounterCore.encounterType !== 'OPD') {
    return NextResponse.json({ error: 'Encounter is not OPD' }, { status: 409 });
  }
  if (encounterCore.status === 'CLOSED') {
    return NextResponse.json({ error: 'Encounter is closed' }, { status: 409 });
  }

  const opd = await prisma.opdEncounter.findFirst({
    where: { tenantId, encounterCoreId },
  });
  if (!opd) {
    return NextResponse.json({ error: 'OPD encounter not found' }, { status: 404 });
  }

  // Optimistic locking
  if (body._version != null && opd.version != null) {
    if (Number(body._version) !== Number(opd.version)) {
      return NextResponse.json(
        { error: 'تم تحديث السجل من شخص آخر. الرجاء إعادة تحميل الصفحة.', code: 'VERSION_CONFLICT' },
        { status: 409 }
      );
    }
  }

  const allowedStates = ['ARRIVED', 'WAITING_NURSE', 'IN_NURSING', 'READY_FOR_DOCTOR'] as const;
  const currentState = String(opd.opdFlowState || '').trim().toUpperCase();
  if (currentState && !(allowedStates as readonly string[]).includes(currentState)) {
    return NextResponse.json(
      {
        error: 'Invalid opdFlowState for nursing entry',
        currentState: currentState || null,
        allowedStates,
      },
      { status: 400 }
    );
  }

  const nursingNote = toText(body.nursingNote);
  const chiefComplaintShort = toText(body.chiefComplaintShort);
  const painScore = toNumber(body.painScore);
  const painLocation = toText(body.painLocation);
  const fallRisk = normalizeFallRisk(body.fallRiskScore ?? body.fallRiskLabel);
  const bodyVitals = (body?.vitals || {}) as Record<string, unknown>;
  const vitals = {
    bp: toText(bodyVitals?.bp ?? body.bp),
    hr: toNumber(bodyVitals?.hr ?? body.hr),
    temp: toNumber(bodyVitals?.temp ?? body.temp),
    rr: toNumber(bodyVitals?.rr ?? body.rr),
    spo2: toNumber(bodyVitals?.spo2 ?? body.spO2 ?? body.spo2),
    weight: toNumber(bodyVitals?.weight ?? body.weight),
    height: toNumber(bodyVitals?.height ?? body.height),
    glucose: toNumber(bodyVitals?.glucose ?? body.glucose),
    headCircumference: toNumber(bodyVitals?.headCircumference ?? body.headCircumference),
    fetalHr: toNumber(bodyVitals?.fetalHr ?? body.fetalHr),
    fundalHeight: toNumber(bodyVitals?.fundalHeight ?? body.fundalHeight),
    bmi: null as number | null,
  };
  if (vitals.weight && vitals.height && vitals.height > 0) {
    vitals.bmi = Math.round((vitals.weight / ((vitals.height / 100) ** 2)) * 10) / 10;
  }

  const consciousnessRaw = String(body.consciousness || 'ALERT').trim().toUpperCase();
  const validConsciousness: ConsciousnessLevel[] = ['ALERT', 'CONFUSION', 'VOICE', 'PAIN', 'UNRESPONSIVE'];
  const consciousness: ConsciousnessLevel = validConsciousness.includes(consciousnessRaw as ConsciousnessLevel)
    ? (consciousnessRaw as ConsciousnessLevel)
    : 'ALERT';
  const onSupplementalO2 = Boolean(body.onSupplementalO2);

  const mewsInput = vitalsToMEWSInput(vitals, consciousness, onSupplementalO2);
  const mewsResult = calculateMEWS(mewsInput);

  // -- GCS (Glasgow Coma Scale) --
  let gcsScore: number | null = null;
  let gcsCategory: string | null = null;
  let gcsDataNorm: Record<string, unknown> | null = null;
  const gcsDataObj = body.gcsData as Record<string, unknown> | null | undefined;
  if (gcsDataObj && typeof gcsDataObj === 'object' && gcsDataObj.eye != null) {
    const gcsInput: GCSInput = {
      eye: Math.max(1, Math.min(4, Number(gcsDataObj.eye) || 4)),
      verbal: Math.max(1, Math.min(5, Number(gcsDataObj.verbal) || 5)),
      motor: Math.max(1, Math.min(6, Number(gcsDataObj.motor) || 6)),
    };
    const gcsResult = calculateGCS(gcsInput, {
      intubated: Boolean(gcsDataObj.intubated),
      isPediatric: Boolean(gcsDataObj.isPediatric),
    });
    gcsScore = gcsResult.totalScore;
    gcsCategory = gcsResult.category;
    gcsDataNorm = {
      eye: gcsResult.eye,
      verbal: gcsResult.verbal,
      motor: gcsResult.motor,
      totalScore: gcsResult.totalScore,
      category: gcsResult.category,
      intubated: gcsResult.intubated,
      isPediatric: gcsResult.isPediatric,
      parameters: gcsResult.parameters,
    };
  }

  // -- Braden Scale --
  let bradenScore: number | null = null;
  let bradenRisk: string | null = null;
  let bradenDataNorm: Record<string, unknown> | null = null;
  const bradenDataObj = body.bradenData as Record<string, unknown> | null | undefined;
  if (bradenDataObj && typeof bradenDataObj === 'object' && bradenDataObj.input) {
    const bradenInput = bradenDataObj.input as Record<string, unknown>;
    const bi: BradenInput = {
      sensoryPerception: Math.max(1, Math.min(4, Number(bradenInput.sensoryPerception) || 4)),
      moisture: Math.max(1, Math.min(4, Number(bradenInput.moisture) || 4)),
      activity: Math.max(1, Math.min(4, Number(bradenInput.activity) || 4)),
      mobility: Math.max(1, Math.min(4, Number(bradenInput.mobility) || 4)),
      nutrition: Math.max(1, Math.min(4, Number(bradenInput.nutrition) || 4)),
      frictionShear: Math.max(1, Math.min(3, Number(bradenInput.frictionShear) || 3)),
    };
    const bradenResult = calculateBraden(bi);
    bradenScore = bradenResult.totalScore;
    bradenRisk = bradenResult.risk;
    bradenDataNorm = bradenResult as unknown as Record<string, unknown>;
  }

  // -- Critical vitals detection --
  const criticalFlags: string[] = [];
  if (vitals.bp) {
    const [sys, dia] = vitals.bp.split('/').map(Number);
    if (!Number.isNaN(sys)) {
      if (sys >= 180) criticalFlags.push(`Critical high BP: ${vitals.bp}`);
      if (sys <= 80) criticalFlags.push(`Critical low BP: ${vitals.bp}`);
    }
    if (!Number.isNaN(dia)) {
      if (dia >= 120) criticalFlags.push(`Critical high diastolic: ${dia}`);
    }
  }
  if (vitals.hr != null) {
    if (vitals.hr >= 150) criticalFlags.push(`Critical high HR: ${vitals.hr}`);
    if (vitals.hr <= 40) criticalFlags.push(`Critical low HR: ${vitals.hr}`);
  }
  if (vitals.spo2 != null && vitals.spo2 <= 90) {
    criticalFlags.push(`Critical low SpO2: ${vitals.spo2}%`);
  }
  if (vitals.temp != null) {
    if (vitals.temp >= 39.5) criticalFlags.push(`Critical high temp: ${vitals.temp}°C`);
    if (vitals.temp <= 35) criticalFlags.push(`Critical low temp: ${vitals.temp}°C`);
  }
  if (vitals.rr != null) {
    if (vitals.rr >= 30) criticalFlags.push(`Critical high RR: ${vitals.rr}`);
    if (vitals.rr <= 8) criticalFlags.push(`Critical low RR: ${vitals.rr}`);
  }

  // -- Auto-set priority based on critical vitals --
  let autoPriority: OpdPriority | null = null;
  if (criticalFlags.length > 0) {
    autoPriority = 'URGENT';
  }

  // Allow manual priority override from body
  const manualPriority = String(body.priority || '').trim().toUpperCase();
  const validPriorities: OpdPriority[] = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];
  const finalPriority = validPriorities.includes(manualPriority as OpdPriority)
    ? (manualPriority as OpdPriority)
    : autoPriority;

  const timeOutRaw = (body?.timeOutChecklist || {}) as Record<string, unknown>;
  const timeOutChecklist = {
    patientIdentified: Boolean(timeOutRaw.patientIdentified),
    procedureConfirmed: Boolean(timeOutRaw.procedureConfirmed),
    siteMarked: Boolean(timeOutRaw.siteMarked),
    consentSigned: Boolean(timeOutRaw.consentSigned),
    allergiesReviewed: Boolean(timeOutRaw.allergiesReviewed),
    completedAt: null as string | null,
    completedByUserId: null as string | null,
  };
  const allChecked =
    timeOutChecklist.patientIdentified &&
    timeOutChecklist.procedureConfirmed &&
    timeOutChecklist.siteMarked &&
    timeOutChecklist.consentSigned &&
    timeOutChecklist.allergiesReviewed;
  if (allChecked) {
    timeOutChecklist.completedAt = new Date().toISOString();
    timeOutChecklist.completedByUserId = userId || null;
  }
  // B7: Support both old format (string) and new structured format (object with hasNone/details)
  const normalizePfeField = (raw: unknown): { hasNone: boolean; details: string | null } => {
    if (typeof raw === 'string') return { hasNone: false, details: toText(raw) };
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      return { hasNone: Boolean(obj.hasNone), details: toText(obj.details) };
    }
    return { hasNone: false, details: null };
  };
  const bodyPfe = (body?.pfe || {}) as Record<string, unknown>;
  const pfe = {
    allergies: normalizePfeField(bodyPfe?.allergies ?? body.allergies),
    medications: normalizePfeField(bodyPfe?.medications ?? body.medications),
    medicalHistory: normalizePfeField(bodyPfe?.medicalHistory ?? body.medicalHistory),
    educationTopics: Array.isArray(bodyPfe?.educationTopics) ? bodyPfe.educationTopics : [],
    method: toText(bodyPfe?.method),
    language: toText(bodyPfe?.language),
    barriers: Array.isArray(bodyPfe?.barriers) ? bodyPfe.barriers : [],
    understanding: toText(bodyPfe?.understanding),
    confirmed: Boolean(bodyPfe?.confirmed),
  };

  // -- Create nursing entry + update OPD encounter in a transaction --
  const [entry, updatedOpd] = await prisma.$transaction([
    prisma.opdNursingEntry.create({
      data: {
        opdEncounterId: opd.id,
        createdByUserId: userId || null,
        nursingNote,
        chiefComplaintShort,
        painScore: painScore != null ? Math.round(painScore) : null,
        painLocation,
        fallRiskScore: fallRisk.score,
        fallRiskLabel: fallRisk.label,
        fallRiskData: body.fallRiskData ? (body.fallRiskData as Prisma.InputJsonValue) : null,
        gcsScore,
        gcsCategory,
        gcsData: gcsDataNorm as Prisma.InputJsonValue,
        sbarData: body.sbarData && typeof body.sbarData === 'object' ? (body.sbarData as Prisma.InputJsonValue) : null,
        painData: body.painData && typeof body.painData === 'object' ? (body.painData as Prisma.InputJsonValue) : null,
        familyCommData: body.familyCommData && typeof body.familyCommData === 'object' ? (body.familyCommData as Prisma.InputJsonValue) : null,
        proceduresData: body.proceduresData && typeof body.proceduresData === 'object' ? (body.proceduresData as Prisma.InputJsonValue) : null,
        ioData: body.ioData && typeof body.ioData === 'object' ? (body.ioData as Prisma.InputJsonValue) : null,
        bradenScore,
        bradenRisk,
        bradenData: bradenDataNorm as Prisma.InputJsonValue,
        carePlanData: body.carePlanData && typeof body.carePlanData === 'object' ? (body.carePlanData as Prisma.InputJsonValue) : null,
        handoverData: body.handoverData && typeof body.handoverData === 'object' ? (body.handoverData as Prisma.InputJsonValue) : null,
        nursingTasksData: body.nursingTasksData && typeof body.nursingTasksData === 'object' ? (body.nursingTasksData as Prisma.InputJsonValue) : null,
        marData: body.marData && typeof body.marData === 'object' ? (body.marData as Prisma.InputJsonValue) : null,
        vitals: vitals as Prisma.InputJsonValue,
        consciousness,
        onSupplementalO2,
        mewsScore: mewsResult.totalScore,
        mewsRiskLevel: mewsResult.riskLevel,
        mewsData: {
          parameters: mewsResult.parameters,
          hasSingleHighParameter: mewsResult.hasSingleHighParameter,
          parametersCompleted: mewsResult.parametersCompleted,
        } as unknown as Prisma.InputJsonValue,
        pfe: pfe as unknown as Prisma.InputJsonValue,
        timeOutChecklist: timeOutChecklist as unknown as Prisma.InputJsonValue,
      },
    }),
    prisma.opdEncounter.update({
      where: { id: opd.id },
      data: {
        version: { increment: 1 },
        ...(criticalFlags.length > 0 && {
          criticalVitalsFlag: {
            active: true,
            alerts: criticalFlags,
            detectedAt: new Date().toISOString(),
            detectedByUserId: userId || null,
            nursingEntryId: null as string | null, // will be set below
          },
        }),
        ...(finalPriority && { priority: finalPriority }),
      },
    }),
  ]);

  // Backfill the nursingEntryId into criticalVitalsFlag now that we have the entry id
  if (criticalFlags.length > 0) {
    await prisma.opdEncounter.update({
      where: { id: opd.id },
      data: {
        criticalVitalsFlag: {
          active: true,
          alerts: criticalFlags,
          detectedAt: new Date().toISOString(),
          detectedByUserId: userId || null,
          nursingEntryId: entry.id,
        },
      },
    });
  }

  await createAuditLog(
    'opd_encounter',
    String(opd.id || encounterCoreId),
    'OPD_NURSING_APPEND',
    userId || 'system',
    user?.email,
    { entryId: entry.id, nursingNote, chiefComplaintShort, painScore, fallRisk, vitals },
    tenantId
  );

  // -- Emit SSE event --
  try {
    opdEventBus.emit({
      type: 'VITALS_SAVED',
      encounterCoreId,
      tenantId,
      data: {
        hasCriticalVitals: criticalFlags.length > 0,
        priority: finalPriority || null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {}

  return NextResponse.json({ success: true, entry });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.nursing.edit' }
);

export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {

  const resolvedParams3 = (params && typeof (params as any).then === 'function') ? await params : params;
  const encounterCoreId = String((resolvedParams3 as any)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
  if (deathGuard) return deathGuard;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, opdNursingCorrectionSchema);
  if ('error' in v) return v.error;
  const { entryId, correctionReason } = v.data;

  const opd = await prisma.opdEncounter.findFirst({
    where: { tenantId, encounterCoreId },
  });
  if (!opd) {
    return NextResponse.json({ error: 'OPD encounter not found' }, { status: 404 });
  }

  // Find the nursing entry to correct
  const targetEntry = await prisma.opdNursingEntry.findFirst({
    where: { id: entryId, opdEncounterId: opd.id },
  });
  if (!targetEntry) {
    return NextResponse.json({ error: 'Nursing entry not found' }, { status: 404 });
  }
  if (targetEntry.isCorrected) {
    return NextResponse.json({ error: 'Entry already corrected' }, { status: 409 });
  }

  const now = new Date();

  // Mark the entry as corrected
  await prisma.opdNursingEntry.update({
    where: { id: entryId },
    data: {
      isCorrected: true,
      correctedAt: now,
      correctedByUserId: userId || null,
      correctionReason,
    },
  });

  // Bump the OPD encounter version
  await prisma.opdEncounter.update({
    where: { id: opd.id },
    data: { version: { increment: 1 } },
  });

  await createAuditLog(
    'opd_encounter',
    String(opd.id || encounterCoreId),
    'OPD_NURSING_CORRECT',
    userId || 'system',
    user?.email,
    { entryId, correctionReason },
    tenantId
  );

  return NextResponse.json({ success: true, correctedEntryId: entryId });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.nursing.edit' }
);
