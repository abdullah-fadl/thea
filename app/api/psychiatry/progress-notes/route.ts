import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

/* ------------------------------------------------------------------ */
/*  GET /api/psychiatry/progress-notes — list progress notes           */
/* ------------------------------------------------------------------ */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const url = new URL(req.url);
    const patientMasterId = url.searchParams.get('patientMasterId') || undefined;
    const treatmentPlanId = url.searchParams.get('treatmentPlanId') || undefined;
    const noteType = url.searchParams.get('noteType') || undefined;
    const status = url.searchParams.get('status') || undefined;

    const where: any = { tenantId };
    if (patientMasterId) where.patientMasterId = patientMasterId;
    if (treatmentPlanId) where.treatmentPlanId = treatmentPlanId;
    if (noteType) where.noteType = noteType;
    if (status) where.status = status;

    const notes = await prisma.psychProgressNote.findMany({
      where,
      orderBy: { noteDate: 'desc' },
      take: 100,
    });

    return NextResponse.json({ notes });
  }),
  { permissionKey: 'psychiatry.view' },
);

/* ------------------------------------------------------------------ */
/*  POST /api/psychiatry/progress-notes — create new progress note     */
/* ------------------------------------------------------------------ */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }: { tenantId: string; userId: string; user: any }) => {
    const body = await req.json();

    if (!body.patientMasterId) {
      return NextResponse.json({ error: 'patientMasterId is required' }, { status: 400 });
    }

    if (!body.noteType) {
      return NextResponse.json({ error: 'noteType is required' }, { status: 400 });
    }

    const validNoteTypes = ['INDIVIDUAL', 'GROUP', 'FAMILY', 'CRISIS', 'DISCHARGE'];
    if (!validNoteTypes.includes(body.noteType)) {
      return NextResponse.json(
        { error: `noteType must be one of: ${validNoteTypes.join(', ')}` },
        { status: 400 },
      );
    }

    // If treatmentPlanId is provided, verify it exists and belongs to this tenant
    if (body.treatmentPlanId) {
      const plan = await prisma.psychTreatmentPlan.findFirst({
        where: { id: body.treatmentPlanId, tenantId },
      });
      if (!plan) {
        return NextResponse.json({ error: 'Treatment plan not found' }, { status: 404 });
      }
    }

    const note = await prisma.psychProgressNote.create({
      data: {
        tenantId,
        patientMasterId: body.patientMasterId,
        episodeId: body.episodeId || null,
        encounterId: body.encounterId || null,
        treatmentPlanId: body.treatmentPlanId || null,
        authorUserId: userId,
        authorName: user?.name || null,
        noteDate: new Date(),
        noteType: body.noteType,
        // DAP format
        dataSection: body.dataSection || null,
        assessmentSection: body.assessmentSection || null,
        planSection: body.planSection || null,
        // Linked modules
        goalProgress: body.goalProgress || null,
        medicationResponse: body.medicationResponse || null,
        riskReassessment: body.riskReassessment || null,
        briefMse: body.briefMse || null,
        // Group therapy link
        groupSessionId: body.groupSessionId || null,
        // Session
        sessionDurationMin: body.sessionDurationMin ?? null,
        nextSessionDate: body.nextSessionDate ? new Date(body.nextSessionDate) : null,
        // Always starts as DRAFT
        status: 'DRAFT',
        notes: body.notes || null,
      } as any,
    });

    logger.info('Progress note created', {
      tenantId,
      userId,
      noteId: note.id,
      noteType: body.noteType,
      category: 'clinical',
      route: '/api/psychiatry/progress-notes',
    });

    return NextResponse.json({ note }, { status: 201 });
  }),
  { permissionKey: 'psychiatry.manage' },
);

/* ------------------------------------------------------------------ */
/*  PUT /api/psychiatry/progress-notes — update / sign / amend         */
/* ------------------------------------------------------------------ */
export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }: { tenantId: string; userId: string; user: any }) => {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Verify note exists and belongs to this tenant
    const existing = await prisma.psychProgressNote.findFirst({
      where: { id: body.id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Progress note not found' }, { status: 404 });
    }

    const update: any = {};

    // ---------- Signing workflow ----------
    if (body.action === 'sign') {
      if (existing.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'Only DRAFT notes can be signed' },
          { status: 400 },
        );
      }
      update.status = 'SIGNED';
      update.signedAt = new Date();
      update.signedBy = user?.name || userId;

      const note = await prisma.psychProgressNote.update({
        where: { id: body.id },
        data: update,
      });

      logger.info('Progress note signed', {
        tenantId, userId, noteId: note.id,
        category: 'clinical', route: '/api/psychiatry/progress-notes',
      });

      return NextResponse.json({ note });
    }

    // ---------- Co-signing workflow ----------
    if (body.action === 'cosign') {
      if (existing.status !== 'SIGNED') {
        return NextResponse.json(
          { error: 'Only SIGNED notes can be co-signed' },
          { status: 400 },
        );
      }
      update.status = 'COSIGNED';
      update.cosignedBy = user?.name || userId;
      update.cosignedAt = new Date();

      const note = await prisma.psychProgressNote.update({
        where: { id: body.id },
        data: update,
      });

      logger.info('Progress note co-signed', {
        tenantId, userId, noteId: note.id,
        category: 'clinical', route: '/api/psychiatry/progress-notes',
      });

      return NextResponse.json({ note });
    }

    // ---------- Amendment workflow ----------
    if (body.action === 'amend') {
      if (existing.status !== 'SIGNED' && existing.status !== 'COSIGNED') {
        return NextResponse.json(
          { error: 'Only SIGNED or COSIGNED notes can be amended' },
          { status: 400 },
        );
      }
      if (!body.amendmentNotes) {
        return NextResponse.json(
          { error: 'amendmentNotes is required for amendments' },
          { status: 400 },
        );
      }
      update.status = 'AMENDED';
      update.amendmentNotes = body.amendmentNotes;

      const note = await prisma.psychProgressNote.update({
        where: { id: body.id },
        data: update,
      });

      logger.info('Progress note amended', {
        tenantId, userId, noteId: note.id,
        category: 'clinical', route: '/api/psychiatry/progress-notes',
      });

      return NextResponse.json({ note });
    }

    // ---------- General update (DRAFT only) ----------
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only DRAFT notes can be edited. Use amend action for signed notes.' },
        { status: 400 },
      );
    }

    // DAP fields
    if (body.dataSection !== undefined) update.dataSection = body.dataSection;
    if (body.assessmentSection !== undefined) update.assessmentSection = body.assessmentSection;
    if (body.planSection !== undefined) update.planSection = body.planSection;

    // Linked modules
    if (body.goalProgress !== undefined) update.goalProgress = body.goalProgress;
    if (body.medicationResponse !== undefined) update.medicationResponse = body.medicationResponse;
    if (body.riskReassessment !== undefined) update.riskReassessment = body.riskReassessment;
    if (body.briefMse !== undefined) update.briefMse = body.briefMse;

    // Metadata
    if (body.treatmentPlanId !== undefined) update.treatmentPlanId = body.treatmentPlanId || null;
    if (body.groupSessionId !== undefined) update.groupSessionId = body.groupSessionId || null;
    if (body.sessionDurationMin !== undefined) update.sessionDurationMin = body.sessionDurationMin;
    if (body.nextSessionDate !== undefined) {
      update.nextSessionDate = body.nextSessionDate ? new Date(body.nextSessionDate) : null;
    }
    if (body.noteType !== undefined) update.noteType = body.noteType;
    if (body.notes !== undefined) update.notes = body.notes;

    const note = await prisma.psychProgressNote.update({
      where: { id: body.id },
      data: update,
    });

    logger.info('Progress note updated', {
      tenantId, userId, noteId: note.id,
      category: 'clinical', route: '/api/psychiatry/progress-notes',
    });

    return NextResponse.json({ note });
  }),
  { permissionKey: 'psychiatry.manage' },
);
