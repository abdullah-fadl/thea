import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STEPS = ['PRE_OP', 'TIME_OUT', 'INTRA_OP', 'POST_OP', 'RECOVERY'] as const;

const NEXT_STEP: Record<string, typeof STEPS[number] | null> = {
  START: 'PRE_OP',
  PRE_OP: 'TIME_OUT',
  TIME_OUT: 'INTRA_OP',
  INTRA_OP: 'POST_OP',
  POST_OP: 'RECOVERY',
  RECOVERY: null,
};

function parseDateOrNull(value: any): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const GET = withAuthTenant(async (req: NextRequest, { tenantId }, params) => {
  const routeParams = params || {};
  const caseId = String((routeParams as Record<string, unknown>).caseId || '').trim();
  if (!caseId) {
    return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
  }

  const items = await prisma.orCaseEvent.findMany({
    where: { tenantId, caseId },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  return NextResponse.json({ items });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' });

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }, params) => {
  const routeParams = params || {};
  const caseId = String((routeParams as Record<string, unknown>).caseId || '').trim();
  if (!caseId) {
    return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    step: z.string().min(1),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const step = String(body.step || '').trim().toUpperCase();
  if (!(STEPS as readonly string[]).includes(step)) {
    return NextResponse.json({ error: 'Invalid step', invalid: ['step'] }, { status: 400 });
  }

  const orCase = await prisma.orCase.findFirst({
    where: { tenantId, id: caseId },
  });
  if (!orCase) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }

  const latestEvents = await prisma.orCaseEvent.findMany({
    where: { tenantId, caseId },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });
  const latestEvent = latestEvents[0] || null;
  const lastStep = String((latestEvent as Record<string, unknown> | null)?.step || 'START').toUpperCase();
  const expected = NEXT_STEP[lastStep] || null;
  if (step !== expected) {
    return NextResponse.json({ error: 'Invalid step transition', expected, current: lastStep }, { status: 409 });
  }

  const missing: string[] = [];
  const invalid: string[] = [];
  let data: any = {};

  if (step === 'PRE_OP') {
    const checklist = body.checklist && typeof body.checklist === 'object' ? body.checklist : {};
    const consentConfirmed = Boolean(body.consentConfirmed);
    const consentAt = parseDateOrNull(body.consentAt);
    const surgeonUserId = String(body.surgeonUserId || '').trim();
    const anesthesiaUserId = String(body.anesthesiaUserId || '').trim();
    const requiredFlags = ['patientIdentified', 'procedureConfirmed', 'siteMarked', 'allergiesReviewed'];
    for (const key of requiredFlags) {
      if (typeof checklist[key] !== 'boolean') missing.push(`checklist.${key}`);
    }
    if (!consentConfirmed) missing.push('consentConfirmed');
    if (!consentAt) missing.push('consentAt');
    if (!surgeonUserId) missing.push('surgeonUserId');
    if (!anesthesiaUserId) missing.push('anesthesiaUserId');
    data = {
      checklist: requiredFlags.reduce<Record<string, boolean>>((acc, key) => {
        acc[key] = Boolean(checklist[key]);
        return acc;
      }, {}),
      consentConfirmed,
      consentAt,
      surgeonUserId,
      anesthesiaUserId,
      notes: body.notes ? String(body.notes || '').trim() : null,
    };
  }

  if (step === 'TIME_OUT') {
    const patientConfirmed = Boolean(body.patientConfirmed);
    const procedureConfirmed = Boolean(body.procedureConfirmed);
    const siteConfirmed = Boolean(body.siteConfirmed);
    if (!patientConfirmed) missing.push('patientConfirmed');
    if (!procedureConfirmed) missing.push('procedureConfirmed');
    if (!siteConfirmed) missing.push('siteConfirmed');
    data = { patientConfirmed, procedureConfirmed, siteConfirmed };
  }

  if (step === 'INTRA_OP') {
    // Enforce pre-op checklist completion before surgery can start
    const [nursingPreOp, anesthesiaPreOp] = await Promise.all([
      prisma.orNursingPreOp.findFirst({ where: { tenantId, caseId } }),
      prisma.orAnesthesiaPreOp.findFirst({ where: { tenantId, caseId } }),
    ]);
    const preOpErrors: string[] = [];
    if (!nursingPreOp || nursingPreOp.status !== 'COMPLETED') {
      preOpErrors.push('Nursing pre-op assessment must be completed before starting surgery');
    }
    if (!anesthesiaPreOp || anesthesiaPreOp.status !== 'COMPLETED') {
      preOpErrors.push('Anesthesia pre-op assessment must be completed before starting surgery');
    }
    if (preOpErrors.length) {
      return NextResponse.json({ error: 'Pre-op checklists incomplete', details: preOpErrors }, { status: 409 });
    }

    const note = String(body.note || '').trim();
    const startedAt = parseDateOrNull(body.startedAt);
    const endedAt = parseDateOrNull(body.endedAt);
    if (!note) missing.push('note');
    if (!startedAt) missing.push('startedAt');
    if (startedAt && endedAt && endedAt.getTime() < startedAt.getTime()) invalid.push('endedAt');
    data = { note, startedAt, endedAt: endedAt || null };
  }

  if (step === 'POST_OP') {
    const note = String(body.note || '').trim();
    const complications = Boolean(body.complications);
    const complicationDescription = String(body.complicationDescription || '').trim();
    if (!note) missing.push('note');
    if (complications && !complicationDescription) missing.push('complicationDescription');
    data = {
      note,
      complications,
      complicationDescription: complications ? complicationDescription : null,
    };
  }

  if (step === 'RECOVERY') {
    const handoffSummary = String(body.handoffSummary || '').trim();
    const destination = String(body.destination || '').trim().toUpperCase();
    if (!handoffSummary) missing.push('handoffSummary');
    if (!destination) missing.push('destination');
    if (destination && !['WARD', 'ICU', 'DISCHARGE'].includes(destination)) invalid.push('destination');
    data = { handoffSummary, destination };
  }

  if (missing.length || invalid.length) {
    return NextResponse.json({ error: 'Validation failed', missing, invalid }, { status: 400 });
  }

  const now = new Date();
  const event = await prisma.orCaseEvent.create({
    data: {
      tenantId,
      caseId,
      step,
      data,
      createdAt: now,
      createdByUserId: userId || null,
    },
  });

  await createAuditLog(
    'or_case_event',
    event.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: event },
    tenantId
  );

  return NextResponse.json({ success: true, event });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' });
