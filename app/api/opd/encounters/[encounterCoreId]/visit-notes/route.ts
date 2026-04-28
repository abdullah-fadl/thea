import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

import { createAuditLog } from '@/lib/utils/audit';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { assertEncounterNotCompleted } from '@/lib/opd/guards';
import { validateBody } from '@/lib/validation/helpers';
import { visitNotesSchema } from '@/lib/validation/opd.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// [D-03] Exact role match to prevent false positives (e.g., 'doctor_assistant')
const ALLOWED_DOCTOR_ROLES = ['doctor', 'physician', 'consultant', 'specialist', 'opd-doctor'];
function isDoctor(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase().trim();
  return ALLOWED_DOCTOR_ROLES.includes(r);
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {

  const encounterCoreId = String((params as Record<string, string>)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
  if (deathGuard) return deathGuard;

  const notes = await prisma.opdVisitNote.findMany({
    where: { tenantId, encounterCoreId },
    orderBy: [{ createdAt: 'desc' }],
    take: 100,
  });

  const authorIds = Array.from(new Set(notes.map((n) => n.createdByUserId).filter(Boolean))) as string[];
  const authors = authorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, email: true, displayName: true },
      })
    : [];
  const authorById = authors.reduce<Record<string, { id: string; email: string; displayName: string | null }>>((acc, author) => {
    acc[author.id] = author;
    return acc;
  }, {});

  const items = notes.map((note) => ({
    ...note,
    author: authorById[note.createdByUserId || ''] || null,
  }));

  return NextResponse.json({ items });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.edit' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  const encounterCoreId = String((params as Record<string, string>)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  // [G-01] Guard: block writes on completed/closed encounters
  const completedGuard = await assertEncounterNotCompleted(tenantId, encounterCoreId);
  if (completedGuard) return completedGuard;

  const allowed =
    isDoctor(role) ||
    canAccessChargeConsole({ email: user?.email, tenantId, role });
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, visitNotesSchema);
  if ('error' in v) return v.error;
  const { chiefComplaint, historyOfPresentIllness: hpiRaw, physicalExam: peRaw, assessment, plan, diagnoses: diagnosesRaw, vitalsSnapshot } = v.data;
  const historyOfPresentIllness = hpiRaw || '';
  const physicalExam = peRaw || '';
  const diagnoses = diagnosesRaw || [];

  const encounterCore = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
    select: { id: true, status: true, patientId: true, encounterType: true },
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

  // [D-07] Validate OPD flow state allows visit notes
  const opdForState = await prisma.opdEncounter.findFirst({
    where: { tenantId, encounterCoreId },
    select: { opdFlowState: true },
  });
  const noteAllowedStates = ['READY_FOR_DOCTOR', 'WAITING_DOCTOR', 'IN_DOCTOR', 'PROCEDURE_PENDING', 'PROCEDURE_DONE_WAITING'];
  if (opdForState && !noteAllowedStates.includes(String(opdForState.opdFlowState || ''))) {
    return NextResponse.json(
      { error: 'Visit notes يمكن كتابتها فقط في مرحلة الطبيب' },
      { status: 400 }
    );
  }

  // Idempotency: prevent duplicate notes from double-click / network retry
  // Check if same author created a note with same chiefComplaint in last 30 seconds
  const recentDupe = await prisma.opdVisitNote.findFirst({
    where: {
      tenantId,
      encounterCoreId,
      createdByUserId: userId,
      chiefComplaint,
      createdAt: { gte: new Date(Date.now() - 30_000) },
    },
    select: { id: true },
  });
  if (recentDupe) {
    const existing = await prisma.opdVisitNote.findUnique({ where: { id: recentDupe.id } });
    return NextResponse.json({ success: true, note: existing, noOp: true });
  }

  const note = await prisma.opdVisitNote.create({
    data: {
      tenantId,
      encounterCoreId,
      patientId: encounterCore.patientId,
      chiefComplaint,
      historyOfPresentIllness: historyOfPresentIllness || null,
      physicalExam: physicalExam || null,
      assessment,
      plan,
      diagnoses: diagnoses as Prisma.InputJsonValue,
      vitalsSnapshot: (vitalsSnapshot as Prisma.InputJsonValue) || null,
      createdByUserId: userId,
    },
  });

  await createAuditLog(
    'opd_visit_note',
    note.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: note },
    tenantId
  );

  return NextResponse.json({ success: true, note });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.edit' }
);

// PUT — upsert (auto-save): updates the latest note by this author, or creates one
export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  const encounterCoreId = String((params as Record<string, string>)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const completedGuard = await assertEncounterNotCompleted(tenantId, encounterCoreId);
  if (completedGuard) return completedGuard;

  const allowed = isDoctor(role) || canAccessChargeConsole({ email: user?.email, tenantId, role });
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, visitNotesSchema);
  if ('error' in v) return v.error;
  const { chiefComplaint, historyOfPresentIllness: hpiRaw, physicalExam: peRaw, assessment, plan, diagnoses: diagnosesRaw, vitalsSnapshot } = v.data;

  // Find existing note by this author for this encounter
  const existing = await prisma.opdVisitNote.findFirst({
    where: { tenantId, encounterCoreId, createdByUserId: userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (existing) {
    const updated = await prisma.opdVisitNote.update({
      where: { id: existing.id },
      data: {
        chiefComplaint,
        historyOfPresentIllness: hpiRaw || null,
        physicalExam: peRaw || null,
        assessment,
        plan,
        diagnoses: (diagnosesRaw || []) as Prisma.InputJsonValue,
        vitalsSnapshot: (vitalsSnapshot as Prisma.InputJsonValue) || null,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ success: true, note: updated, upsert: 'updated' });
  }

  // No existing note — create new
  const encounterCore = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
    select: { id: true, patientId: true },
  });
  if (!encounterCore) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  const note = await prisma.opdVisitNote.create({
    data: {
      tenantId,
      encounterCoreId,
      patientId: encounterCore.patientId,
      chiefComplaint,
      historyOfPresentIllness: hpiRaw || null,
      physicalExam: peRaw || null,
      assessment,
      plan,
      diagnoses: (diagnosesRaw || []) as Prisma.InputJsonValue,
      vitalsSnapshot: (vitalsSnapshot as Prisma.InputJsonValue) || null,
      createdByUserId: userId,
    },
  });

  return NextResponse.json({ success: true, note, upsert: 'created' });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.edit' }
);
