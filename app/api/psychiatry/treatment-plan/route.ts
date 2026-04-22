import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// =============================================================================
// Helpers
// =============================================================================

/** Compute the next review date from a schedule token. */
function computeNextReview(schedule: string, from?: Date): Date {
  const base = from ?? new Date();
  const next = new Date(base);
  switch (schedule) {
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'BIWEEKLY':
      next.setDate(next.getDate() + 14);
      break;
    case 'MONTHLY':
      next.setDate(next.getDate() + 30);
      break;
    default:
      next.setDate(next.getDate() + 30);
  }
  return next;
}

// =============================================================================
// GET — List treatment plans (filterable)
// =============================================================================

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const url = req.nextUrl;
    const patientMasterId = url.searchParams.get('patientMasterId');
    const status = url.searchParams.get('status'); // ACTIVE | COMPLETED | DISCONTINUED

    const where: any = { tenantId };
    if (patientMasterId) where.patientMasterId = patientMasterId;
    if (status) where.status = status;

    const plans = await (prisma as Record<string, any>).psychTreatmentPlan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ plans });
  }),
  { permissionKey: 'psychiatry.view' },
);

// =============================================================================
// POST — Create a new treatment plan
// =============================================================================

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }: { tenantId: string; userId: string; user: any }) => {
    const body = await req.json();

    if (!body.patientMasterId) {
      return NextResponse.json({ error: 'patientMasterId is required' }, { status: 400 });
    }

    // Auto-calculate nextReviewDate when schedule is provided but date is not
    let nextReviewDate: Date | null = null;
    if (body.nextReviewDate) {
      nextReviewDate = new Date(body.nextReviewDate);
    } else if (body.reviewSchedule) {
      nextReviewDate = computeNextReview(body.reviewSchedule);
    }

    // Validate goals structure (if provided)
    const goals = Array.isArray(body.goals)
      ? body.goals.map((g: any, idx: number) => ({
          id: g.id || `goal-${Date.now()}-${idx}`,
          type: g.type || 'SHORT_TERM',
          description: g.description || '',
          targetDate: g.targetDate || null,
          status: g.status || 'NOT_STARTED',
          interventions: Array.isArray(g.interventions)
            ? g.interventions.map((iv: any) => ({
                type: iv.type || 'CBT',
                detail: iv.detail || '',
                responsibleClinician: iv.responsibleClinician || '',
              }))
            : [],
          reviewNotes: g.reviewNotes || null,
          lastReviewed: g.lastReviewed || null,
        }))
      : [];

    const plan = await (prisma as Record<string, any>).psychTreatmentPlan.create({
      data: {
        tenantId,
        patientMasterId: body.patientMasterId,
        episodeId: body.episodeId || null,
        encounterId: body.encounterId || null,
        createdByUserId: userId,
        createdByName: user?.name || body.createdByName || null,
        dsm5Diagnosis: body.dsm5Diagnosis || null,
        icdCode: body.icdCode || null,
        diagnosisNotes: body.diagnosisNotes || null,
        psychiatricProblems: body.psychiatricProblems || [],
        medicalProblems: body.medicalProblems || [],
        goals,
        patientInvolved: body.patientInvolved ?? false,
        familyInvolved: body.familyInvolved ?? false,
        participationNotes: body.participationNotes || null,
        reviewSchedule: body.reviewSchedule || null,
        nextReviewDate,
        reviewHistory: [],
        status: 'ACTIVE',
        notes: body.notes || null,
      },
    });

    logger.info('Treatment plan created', {
      category: 'clinical',
      tenantId,
      userId,
      planId: plan.id,
      patientMasterId: body.patientMasterId,
    });

    return NextResponse.json({ plan }, { status: 201 });
  }),
  { permissionKey: 'psychiatry.manage' },
);

// =============================================================================
// PUT — Update an existing treatment plan
// =============================================================================

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }: { tenantId: string; userId: string; user: any }) => {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Verify plan belongs to this tenant
    const existing = await (prisma as Record<string, any>).psychTreatmentPlan.findFirst({
      where: { id: body.id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Treatment plan not found' }, { status: 404 });
    }

    // Build update payload
    const update: any = {};

    // Diagnosis fields
    if (body.dsm5Diagnosis !== undefined) update.dsm5Diagnosis = body.dsm5Diagnosis;
    if (body.icdCode !== undefined) update.icdCode = body.icdCode;
    if (body.diagnosisNotes !== undefined) update.diagnosisNotes = body.diagnosisNotes;

    // Problem lists
    if (body.psychiatricProblems !== undefined) update.psychiatricProblems = body.psychiatricProblems;
    if (body.medicalProblems !== undefined) update.medicalProblems = body.medicalProblems;

    // Goals
    if (body.goals !== undefined) {
      update.goals = Array.isArray(body.goals)
        ? body.goals.map((g: any, idx: number) => ({
            id: g.id || `goal-${Date.now()}-${idx}`,
            type: g.type || 'SHORT_TERM',
            description: g.description || '',
            targetDate: g.targetDate || null,
            status: g.status || 'NOT_STARTED',
            interventions: Array.isArray(g.interventions)
              ? g.interventions.map((iv: any) => ({
                  type: iv.type || 'CBT',
                  detail: iv.detail || '',
                  responsibleClinician: iv.responsibleClinician || '',
                }))
              : [],
            reviewNotes: g.reviewNotes || null,
            lastReviewed: g.lastReviewed || null,
          }))
        : [];
    }

    // Involvement
    if (body.patientInvolved !== undefined) update.patientInvolved = body.patientInvolved;
    if (body.familyInvolved !== undefined) update.familyInvolved = body.familyInvolved;
    if (body.participationNotes !== undefined) update.participationNotes = body.participationNotes;

    // Review schedule
    if (body.reviewSchedule !== undefined) update.reviewSchedule = body.reviewSchedule;
    if (body.nextReviewDate !== undefined) update.nextReviewDate = body.nextReviewDate ? new Date(body.nextReviewDate) : null;
    if (body.notes !== undefined) update.notes = body.notes;

    // ---- Status change logic ----
    if (body.status && body.status !== existing.status) {
      update.status = body.status;
      if (body.status === 'COMPLETED' || body.status === 'DISCONTINUED') {
        update.discontinuedReason = body.discontinuedReason || null;
      }
    }

    // ---- Review entry logic ----
    if (body.addReview) {
      const existingHistory: any[] = Array.isArray(existing.reviewHistory) ? existing.reviewHistory : [];
      const reviewEntry = {
        reviewedAt: new Date().toISOString(),
        reviewedBy: user?.name || userId,
        reviewedByUserId: userId,
        notes: body.addReview.notes || '',
        goalsUpdated: body.addReview.goalsUpdated ?? false,
      };
      update.reviewHistory = [...existingHistory, reviewEntry];
      update.lastReviewedAt = new Date();
      update.lastReviewedBy = user?.name || userId;

      // Recalculate next review date based on schedule
      const schedule = (body.reviewSchedule || existing.reviewSchedule) as string | null;
      if (schedule) {
        update.nextReviewDate = computeNextReview(schedule);
      }
    }

    const plan = await (prisma as Record<string, any>).psychTreatmentPlan.update({
      where: { id: body.id },
      data: update,
    });

    logger.info('Treatment plan updated', {
      category: 'clinical',
      tenantId,
      userId,
      planId: plan.id,
      statusChange: body.status !== existing.status ? body.status : undefined,
    });

    return NextResponse.json({ plan });
  }),
  { permissionKey: 'psychiatry.manage' },
);
