import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler, BadRequestError, NotFoundError } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';
import {
  calculateWaitingDays,
  calculatePriorityScore,
  getValidStatusTransitions,
  ORGAN_TYPE_VALUES,
  BLOOD_TYPE_VALUES,
  URGENCY_STATUS_VALUES,
  MEDICAL_STATUS_VALUES,
  DIALYSIS_TYPE_VALUES,
  type UrgencyStatus,
  type MedicalStatus,
  type OrganType,
} from '@/lib/transplant/waitlistDefinitions';

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseSearchParams(req: NextRequest) {
  const url = new URL(req.url);
  return {
    organType: url.searchParams.get('organType'),
    medicalStatus: url.searchParams.get('medicalStatus'),
    urgencyStatus: url.searchParams.get('urgencyStatus'),
    bloodType: url.searchParams.get('bloodType'),
    search: url.searchParams.get('search'),
  };
}

// ── GET — List waitlist entries with filters + stats ────────────────────────

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const { organType, medicalStatus, urgencyStatus, bloodType, search } =
      parseSearchParams(req);

    // Build where clause
    const where: any = { tenantId };
    if (organType && ORGAN_TYPE_VALUES.includes(organType as OrganType)) {
      where.organType = organType;
    }
    if (medicalStatus && MEDICAL_STATUS_VALUES.includes(medicalStatus as MedicalStatus)) {
      where.medicalStatus = medicalStatus;
    }
    if (urgencyStatus && URGENCY_STATUS_VALUES.includes(urgencyStatus as UrgencyStatus)) {
      where.urgencyStatus = urgencyStatus;
    }
    if (bloodType && BLOOD_TYPE_VALUES.includes(bloodType as never)) {
      where.bloodType = bloodType;
    }
    if (search) {
      where.OR = [
        { primaryDiagnosis: { contains: search, mode: 'insensitive' } },
        { icdCode: { contains: search, mode: 'insensitive' } },
        { patientMasterId: { contains: search, mode: 'insensitive' } },
        { transplantCenter: { contains: search, mode: 'insensitive' } },
        { region: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch entries — recalculate waitingDays for active entries
    const entries = await prisma.transplantWaitlistEntry.findMany({
      where,
      orderBy: [{ priorityScore: 'desc' }, { listingDate: 'asc' }],
      take: 200,
    });

    // Recalculate waiting days on the fly for active entries
    const now = new Date();
    const enriched = entries.map((e: any) => {
      const waitingDays =
        e.medicalStatus === 'ACTIVE'
          ? calculateWaitingDays(e.listingDate)
          : e.waitingDays;
      return { ...e, waitingDays };
    });

    // ── Stats ─────────────────────────────────────────────────────────────

    const allActive = await prisma.transplantWaitlistEntry.findMany({
      where: { tenantId, medicalStatus: 'ACTIVE' },
      select: {
        organType: true,
        waitingDays: true,
        listingDate: true,
        urgencyStatus: true,
        evaluationComplete: true,
      },
      take: 500,
    });

    const totalActive = allActive.length;

    // Average wait time (use recalculated days)
    const avgWaitTime =
      totalActive > 0
        ? Math.round(
            allActive.reduce(
              (sum: number, e: any) => sum + calculateWaitingDays(e.listingDate),
              0,
            ) / totalActive,
          )
        : 0;

    // By organ
    const byOrgan: Record<string, number> = {};
    allActive.forEach((e: any) => {
      byOrgan[e.organType] = (byOrgan[e.organType] || 0) + 1;
    });

    // Urgency breakdown
    const urgencyBreakdown: Record<string, number> = {
      EMERGENT: 0,
      URGENT: 0,
      ROUTINE: 0,
    };
    allActive.forEach((e: any) => {
      if (urgencyBreakdown[e.urgencyStatus] !== undefined) {
        urgencyBreakdown[e.urgencyStatus]++;
      }
    });

    // Longest wait
    const longestWait =
      totalActive > 0
        ? Math.max(...allActive.map((e: any) => calculateWaitingDays(e.listingDate)))
        : 0;

    // Pending evaluations
    const pendingEval = allActive.filter((e: any) => !e.evaluationComplete).length;

    // Transplanted this year
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const transplantedThisYear = await prisma.transplantWaitlistEntry.count({
      where: {
        tenantId,
        medicalStatus: 'TRANSPLANTED',
        updatedAt: { gte: yearStart },
      },
    });

    // Blood type distribution among active
    const bloodTypeDistribution: Record<string, number> = {};
    const allActiveFull = await prisma.transplantWaitlistEntry.findMany({
      where: { tenantId, medicalStatus: 'ACTIVE' },
      select: { bloodType: true },
      take: 500,
    });
    allActiveFull.forEach((e: any) => {
      bloodTypeDistribution[e.bloodType] = (bloodTypeDistribution[e.bloodType] || 0) + 1;
    });

    // Recent status changes (last 50)
    const allWithHistory = await prisma.transplantWaitlistEntry.findMany({
      where: { tenantId, statusHistory: { not: null } },
      select: {
        id: true,
        patientMasterId: true,
        organType: true,
        statusHistory: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    const recentChanges: any[] = [];
    allWithHistory.forEach((entry: any) => {
      const history = Array.isArray(entry.statusHistory) ? entry.statusHistory : [];
      history.forEach((h: any) => {
        recentChanges.push({
          entryId: entry.id,
          patientMasterId: entry.patientMasterId,
          organType: entry.organType,
          ...h,
        });
      });
    });
    recentChanges.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    // Outcome rates
    const allEntries = await prisma.transplantWaitlistEntry.groupBy({
      by: ['medicalStatus'],
      where: { tenantId },
      _count: { id: true },
    });
    const outcomes: Record<string, number> = {};
    allEntries.forEach((g: any) => {
      outcomes[g.medicalStatus] = g._count.id;
    });

    return NextResponse.json({
      entries: enriched,
      stats: {
        totalActive,
        avgWaitTime,
        byOrgan,
        urgencyBreakdown,
        longestWait,
        pendingEval,
        transplantedThisYear,
        bloodTypeDistribution,
        outcomes,
        recentChanges: recentChanges.slice(0, 50),
      },
    });
  }),
  { permissionKey: 'transplant.view' },
);

// ── POST — Create new waitlist entry ────────────────────────────────────────

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    const body = await req.json();

    // Validate required fields
    const required = ['patientMasterId', 'organType', 'bloodType', 'primaryDiagnosis', 'listingDate'];
    for (const field of required) {
      if (!body[field]) {
        throw new BadRequestError(`Missing required field: ${field}`);
      }
    }

    if (!ORGAN_TYPE_VALUES.includes(body.organType)) {
      throw new BadRequestError(`Invalid organ type: ${body.organType}`);
    }
    if (!BLOOD_TYPE_VALUES.includes(body.bloodType)) {
      throw new BadRequestError(`Invalid blood type: ${body.bloodType}`);
    }

    const urgency: UrgencyStatus = URGENCY_STATUS_VALUES.includes(body.urgencyStatus)
      ? body.urgencyStatus
      : 'ROUTINE';

    const listingDate = new Date(body.listingDate);
    const waitingDays = calculateWaitingDays(listingDate);
    const priorityScore = calculatePriorityScore(
      urgency,
      waitingDays,
      body.meldScore ?? null,
      body.pra ?? null,
      body.previousTransplants ?? 0,
    );

    const entry = await prisma.transplantWaitlistEntry.create({
      data: {
        tenantId,
        patientMasterId: body.patientMasterId,
        caseId: body.caseId || null,
        organType: body.organType,
        bloodType: body.bloodType,
        urgencyStatus: urgency,
        medicalStatus: 'ACTIVE',
        listingDate,
        evaluationComplete: body.evaluationComplete ?? false,
        primaryDiagnosis: body.primaryDiagnosis,
        icdCode: body.icdCode || null,
        meldScore: body.meldScore != null ? Number(body.meldScore) : null,
        childPughScore: body.childPughScore || null,
        pra: body.pra != null ? Number(body.pra) : null,
        hlaTyping: body.hlaTyping ?? null,
        crossmatchHistory: body.crossmatchHistory ?? [],
        dialysisStartDate: body.dialysisStartDate ? new Date(body.dialysisStartDate) : null,
        dialysisType: body.dialysisType && DIALYSIS_TYPE_VALUES.includes(body.dialysisType) ? body.dialysisType : null,
        previousTransplants: Number(body.previousTransplants) || 0,
        waitingDays,
        priorityScore,
        region: body.region || null,
        transplantCenter: body.transplantCenter || null,
        statusHistory: [
          {
            date: new Date().toISOString(),
            from: '-',
            to: 'ACTIVE',
            reason: 'Initial listing',
            by: userId,
          },
        ],
        notes: body.notes || null,
        lastReviewDate: body.lastReviewDate ? new Date(body.lastReviewDate) : null,
        nextReviewDate: body.nextReviewDate ? new Date(body.nextReviewDate) : null,
      },
    });

    return NextResponse.json({ entry }, { status: 201 });
  }),
  { permissionKey: 'transplant.manage' },
);

// ── PUT — Update waitlist entry ─────────────────────────────────────────────

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    const body = await req.json();

    if (!body.id) {
      throw new BadRequestError('Missing entry id');
    }

    // Fetch existing entry
    const existing = await prisma.transplantWaitlistEntry.findFirst({
      where: { id: body.id, tenantId },
    });
    if (!existing) {
      throw new NotFoundError('Waitlist entry not found');
    }

    const updates: any = {};

    // ── Status transition ──────────────────────────────────────────────
    if (body.medicalStatus && body.medicalStatus !== existing.medicalStatus) {
      const validTransitions = getValidStatusTransitions(existing.medicalStatus as MedicalStatus);
      if (!validTransitions.includes(body.medicalStatus as MedicalStatus)) {
        throw new BadRequestError(
          `Invalid status transition from ${existing.medicalStatus} to ${body.medicalStatus}`,
        );
      }
      if (!body.statusReason) {
        throw new BadRequestError('Status change requires a reason');
      }

      updates.medicalStatus = body.medicalStatus;

      // Append to statusHistory
      const history = Array.isArray(existing.statusHistory) ? [...existing.statusHistory] : [];
      history.push({
        date: new Date().toISOString(),
        from: existing.medicalStatus,
        to: body.medicalStatus,
        reason: body.statusReason,
        by: userId,
      });
      updates.statusHistory = history;

      // If removed or deceased, set removed fields
      if (body.medicalStatus === 'REMOVED' || body.medicalStatus === 'DECEASED') {
        updates.removedReason = body.statusReason;
        updates.removedDate = new Date();
      }
      // If transplanted, freeze waiting days
      if (body.medicalStatus === 'TRANSPLANTED') {
        updates.waitingDays = calculateWaitingDays(existing.listingDate);
      }
    }

    // ── Clinical data updates ──────────────────────────────────────────
    if (body.meldScore !== undefined) updates.meldScore = body.meldScore != null ? Number(body.meldScore) : null;
    if (body.childPughScore !== undefined) updates.childPughScore = body.childPughScore || null;
    if (body.pra !== undefined) updates.pra = body.pra != null ? Number(body.pra) : null;
    if (body.hlaTyping !== undefined) updates.hlaTyping = body.hlaTyping;
    if (body.crossmatchHistory !== undefined) updates.crossmatchHistory = body.crossmatchHistory;
    if (body.dialysisStartDate !== undefined) {
      updates.dialysisStartDate = body.dialysisStartDate ? new Date(body.dialysisStartDate) : null;
    }
    if (body.dialysisType !== undefined) updates.dialysisType = body.dialysisType || null;
    if (body.evaluationComplete !== undefined) updates.evaluationComplete = body.evaluationComplete;
    if (body.previousTransplants !== undefined) updates.previousTransplants = Number(body.previousTransplants);

    // ── General updates ────────────────────────────────────────────────
    if (body.urgencyStatus && URGENCY_STATUS_VALUES.includes(body.urgencyStatus)) {
      updates.urgencyStatus = body.urgencyStatus;
    }
    if (body.primaryDiagnosis) updates.primaryDiagnosis = body.primaryDiagnosis;
    if (body.icdCode !== undefined) updates.icdCode = body.icdCode || null;
    if (body.region !== undefined) updates.region = body.region || null;
    if (body.transplantCenter !== undefined) updates.transplantCenter = body.transplantCenter || null;
    if (body.notes !== undefined) updates.notes = body.notes || null;
    if (body.lastReviewDate !== undefined) {
      updates.lastReviewDate = body.lastReviewDate ? new Date(body.lastReviewDate) : null;
    }
    if (body.nextReviewDate !== undefined) {
      updates.nextReviewDate = body.nextReviewDate ? new Date(body.nextReviewDate) : null;
    }

    // ── Recalculate priority & waiting days ─────────────────────────────
    const finalUrgency = (updates.urgencyStatus || existing.urgencyStatus) as UrgencyStatus;
    const finalMeld = updates.meldScore !== undefined ? updates.meldScore : existing.meldScore;
    const finalPra = updates.pra !== undefined ? updates.pra : existing.pra;
    const finalPrevious = updates.previousTransplants !== undefined
      ? updates.previousTransplants
      : existing.previousTransplants;
    const finalStatus = (updates.medicalStatus || existing.medicalStatus) as string;

    if (finalStatus === 'ACTIVE') {
      updates.waitingDays = calculateWaitingDays(existing.listingDate);
    }

    updates.priorityScore = calculatePriorityScore(
      finalUrgency,
      calculateWaitingDays(existing.listingDate),
      finalMeld as number | null,
      finalPra as number | null,
      finalPrevious as number,
    );

    const updated = await prisma.transplantWaitlistEntry.update({
      where: { id: body.id },
      data: updates,
    });

    return NextResponse.json({ entry: updated });
  }),
  { permissionKey: 'transplant.manage' },
);
