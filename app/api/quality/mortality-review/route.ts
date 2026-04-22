import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessQuality } from '@/lib/quality/access';
import { createAuditLog } from '@/lib/utils/audit';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEATH_TYPES = new Set(['EXPECTED', 'UNEXPECTED', 'PERIOPERATIVE', 'ICU', 'ED']);
const PREVENTABILITY = new Set(['DEFINITELY_PREVENTABLE', 'PROBABLY_PREVENTABLE', 'NOT_PREVENTABLE', 'UNKNOWN']);
const QUALITY_OF_CARE = new Set(['APPROPRIATE', 'PARTIALLY_APPROPRIATE', 'INAPPROPRIATE']);
const STATUSES = new Set(['PENDING', 'IN_REVIEW', 'COMMITTEE_REVIEW', 'COMPLETED', 'CLOSED']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeLengthOfStay(admissionDate: string | Date | null | undefined, dateOfDeath: string | Date): number | null {
  if (!admissionDate) return null;
  const admit = new Date(admissionDate);
  const death = new Date(dateOfDeath);
  if (isNaN(admit.getTime()) || isNaN(death.getTime())) return null;
  const diffMs = death.getTime() - admit.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

// ---------------------------------------------------------------------------
// GET — List mortality reviews with filters & stats
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
    if (!canAccessQuality({ email: user?.email, tenantId, role })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status')?.trim().toUpperCase() || '';
    const deathType = url.searchParams.get('deathType')?.trim().toUpperCase() || '';
    const preventability = url.searchParams.get('preventability')?.trim().toUpperCase() || '';
    const department = url.searchParams.get('department')?.trim() || '';
    const dateFrom = url.searchParams.get('dateFrom')?.trim() || '';
    const dateTo = url.searchParams.get('dateTo')?.trim() || '';

    // Build where clause
    const where: Record<string, unknown> = { tenantId };
    if (status && STATUSES.has(status)) where.status = status;
    if (deathType && DEATH_TYPES.has(deathType)) where.deathType = deathType;
    if (preventability && PREVENTABILITY.has(preventability)) where.preventability = preventability;
    if (department) where.department = { contains: department, mode: 'insensitive' };
    if (dateFrom || dateTo) {
      const dateRange: Record<string, Date> = {};
      if (dateFrom) dateRange.gte = new Date(dateFrom);
      if (dateTo) dateRange.lte = new Date(dateTo + 'T23:59:59.999Z');
      where.dateOfDeath = dateRange;
    }

    const items = await prisma.mortalityReview.findMany({
      where,
      orderBy: { dateOfDeath: 'desc' },
      take: 200,
    });

    // Compute stats from all tenant data (no filters, for KPI accuracy)
    const allItems = await prisma.mortalityReview.findMany({
      where: { tenantId },
      select: {
        id: true,
        deathType: true,
        preventability: true,
        department: true,
        status: true,
        lengthOfStay: true,
        mAndMPresented: true,
        recommendations: true,
        dateOfDeath: true,
        contributingFactors: true,
        systemIssues: true,
      },
      take: 500,
    });

    // Total deaths
    const totalDeaths = allItems.length;

    // Preventable deaths count
    const preventableDeaths = allItems.filter(
      (i) => i.preventability === 'DEFINITELY_PREVENTABLE' || i.preventability === 'PROBABLY_PREVENTABLE'
    ).length;

    // Under review count
    const underReview = allItems.filter(
      (i) => i.status === 'PENDING' || i.status === 'IN_REVIEW' || i.status === 'COMMITTEE_REVIEW'
    ).length;

    // Avg length of stay
    const losValues = allItems.filter((i) => typeof i.lengthOfStay === 'number' && i.lengthOfStay >= 0).map((i) => i.lengthOfStay as number);
    const avgLos = losValues.length ? Math.round((losValues.reduce((a: number, b: number) => a + b, 0) / losValues.length) * 10) / 10 : 0;

    // M&M presented rate
    const completedCases = allItems.filter((i) => i.status === 'COMPLETED' || i.status === 'CLOSED');
    const presentedCount = completedCases.filter((i) => i.mAndMPresented).length;
    const mAndMRate = completedCases.length ? Math.round((presentedCount / completedCases.length) * 100) : 0;

    // Action items pending: count recommendations with status != COMPLETED across all reviews
    let actionItemsPending = 0;
    for (const item of allItems) {
      const recs = Array.isArray(item.recommendations) ? item.recommendations : [];
      for (const rec of recs) {
        if (rec && typeof rec === 'object' && (rec as any).status !== 'COMPLETED') {
          actionItemsPending++;
        }
      }
    }

    // By death type
    const byDeathType: Record<string, number> = {};
    for (const item of allItems) {
      byDeathType[item.deathType] = (byDeathType[item.deathType] || 0) + 1;
    }

    // By preventability
    const byPreventability: Record<string, number> = {};
    for (const item of allItems) {
      byPreventability[item.preventability] = (byPreventability[item.preventability] || 0) + 1;
    }

    // By department
    const byDepartment: Record<string, number> = {};
    for (const item of allItems) {
      if (item.department) {
        byDepartment[item.department] = (byDepartment[item.department] || 0) + 1;
      }
    }

    // Monthly trend (last 12 months)
    const monthlyTrend: Record<string, number> = {};
    for (const item of allItems) {
      const d = new Date(item.dateOfDeath);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyTrend[key] = (monthlyTrend[key] || 0) + 1;
    }

    // Contributing factors frequency
    const contributingFactorsFreq: Record<string, number> = {};
    for (const item of allItems) {
      const factors = Array.isArray(item.contributingFactors) ? (item.contributingFactors as unknown[]) : [];
      for (const f of factors) {
        const cat = String((f as any)?.category || (f as any)?.factor || 'Unknown');
        contributingFactorsFreq[cat] = (contributingFactorsFreq[cat] || 0) + 1;
      }
    }

    // System issues frequency
    const systemIssuesFreq: Record<string, number> = {};
    for (const item of allItems) {
      const issues = Array.isArray(item.systemIssues) ? (item.systemIssues as unknown[]) : [];
      for (const iss of issues) {
        const cat = String((iss as any)?.category || (iss as any)?.issue || 'Unknown');
        systemIssuesFreq[cat] = (systemIssuesFreq[cat] || 0) + 1;
      }
    }

    const stats = {
      totalDeaths,
      preventableDeaths,
      underReview,
      avgLos,
      mAndMRate,
      actionItemsPending,
      byDeathType,
      byPreventability,
      byDepartment,
      monthlyTrend,
      contributingFactorsFreq,
      systemIssuesFreq,
    };

    return NextResponse.json({ items, stats });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'quality.view' }
);

// ---------------------------------------------------------------------------
// POST — Create a new mortality review
// ---------------------------------------------------------------------------

const createSchema = z.object({
  patientMasterId: z.string().min(1),
  encounterId: z.string().optional().nullable(),
  episodeId: z.string().optional().nullable(),
  dateOfDeath: z.string().min(1),
  ageAtDeath: z.number().int().min(0).optional().nullable(),
  gender: z.string().optional().nullable(),
  primaryDiagnosis: z.string().min(1),
  icdCode: z.string().optional().nullable(),
  secondaryDiagnoses: z.array(z.any()).optional().nullable(),
  department: z.string().min(1),
  attendingPhysician: z.string().min(1),
  admissionDate: z.string().optional().nullable(),
  deathType: z.enum(['EXPECTED', 'UNEXPECTED', 'PERIOPERATIVE', 'ICU', 'ED']),
  preventability: z.enum(['DEFINITELY_PREVENTABLE', 'PROBABLY_PREVENTABLE', 'NOT_PREVENTABLE', 'UNKNOWN']).optional(),
  qualityOfCare: z.enum(['APPROPRIATE', 'PARTIALLY_APPROPRIATE', 'INAPPROPRIATE']).optional().nullable(),
  delayInDiagnosis: z.boolean().optional(),
  delayInTreatment: z.boolean().optional(),
  communicationIssue: z.boolean().optional(),
  handoffIssue: z.boolean().optional(),
  timelineOfCare: z.array(z.any()).optional().nullable(),
  contributingFactors: z.array(z.any()).optional().nullable(),
  systemIssues: z.array(z.any()).optional().nullable(),
  findings: z.string().optional().nullable(),
  recommendations: z.array(z.any()).optional().nullable(),
  lessonsLearned: z.string().optional().nullable(),
  actionPlan: z.string().optional().nullable(),
  reviewCommittee: z.array(z.any()).optional().nullable(),
  notes: z.string().optional().nullable(),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role, userId }) => {
    if (!canAccessQuality({ email: user?.email, tenantId, role })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const lengthOfStay = computeLengthOfStay(d.admissionDate, d.dateOfDeath);

    const now = new Date();
    const review = await prisma.mortalityReview.create({
      data: {
        tenantId,
        patientMasterId: d.patientMasterId,
        encounterId: d.encounterId || null,
        episodeId: d.episodeId || null,
        dateOfDeath: new Date(d.dateOfDeath),
        ageAtDeath: d.ageAtDeath ?? null,
        gender: d.gender || null,
        primaryDiagnosis: d.primaryDiagnosis,
        icdCode: d.icdCode || null,
        secondaryDiagnoses: d.secondaryDiagnoses || null,
        department: d.department,
        attendingPhysician: d.attendingPhysician,
        admissionDate: d.admissionDate ? new Date(d.admissionDate) : null,
        lengthOfStay,
        deathType: d.deathType,
        preventability: d.preventability || 'UNKNOWN',
        qualityOfCare: d.qualityOfCare || null,
        delayInDiagnosis: d.delayInDiagnosis ?? false,
        delayInTreatment: d.delayInTreatment ?? false,
        communicationIssue: d.communicationIssue ?? false,
        handoffIssue: d.handoffIssue ?? false,
        timelineOfCare: d.timelineOfCare || null,
        contributingFactors: d.contributingFactors || null,
        systemIssues: d.systemIssues || null,
        findings: d.findings || null,
        recommendations: d.recommendations || null,
        lessonsLearned: d.lessonsLearned || null,
        actionPlan: d.actionPlan || null,
        reviewCommittee: d.reviewCommittee || null,
        reviewerId: userId || null,
        reviewerName: user?.email || null,
        notes: d.notes || null,
        status: 'PENDING',
        mAndMPresented: false,
        createdAt: now,
      },
    });

    await createAuditLog(
      'mortality_review',
      review.id,
      'CREATE',
      userId || 'system',
      user?.email,
      { after: review },
      tenantId
    );

    return NextResponse.json({ success: true, id: review.id, review });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'quality.manage' }
);

// ---------------------------------------------------------------------------
// PUT — Update an existing mortality review
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  id: z.string().min(1),
  patientMasterId: z.string().optional(),
  encounterId: z.string().optional().nullable(),
  episodeId: z.string().optional().nullable(),
  dateOfDeath: z.string().optional(),
  ageAtDeath: z.number().int().min(0).optional().nullable(),
  gender: z.string().optional().nullable(),
  primaryDiagnosis: z.string().optional(),
  icdCode: z.string().optional().nullable(),
  secondaryDiagnoses: z.array(z.any()).optional().nullable(),
  department: z.string().optional(),
  attendingPhysician: z.string().optional(),
  admissionDate: z.string().optional().nullable(),
  deathType: z.enum(['EXPECTED', 'UNEXPECTED', 'PERIOPERATIVE', 'ICU', 'ED']).optional(),
  preventability: z.enum(['DEFINITELY_PREVENTABLE', 'PROBABLY_PREVENTABLE', 'NOT_PREVENTABLE', 'UNKNOWN']).optional(),
  qualityOfCare: z.enum(['APPROPRIATE', 'PARTIALLY_APPROPRIATE', 'INAPPROPRIATE']).optional().nullable(),
  delayInDiagnosis: z.boolean().optional(),
  delayInTreatment: z.boolean().optional(),
  communicationIssue: z.boolean().optional(),
  handoffIssue: z.boolean().optional(),
  timelineOfCare: z.array(z.any()).optional().nullable(),
  contributingFactors: z.array(z.any()).optional().nullable(),
  systemIssues: z.array(z.any()).optional().nullable(),
  findings: z.string().optional().nullable(),
  recommendations: z.array(z.any()).optional().nullable(),
  lessonsLearned: z.string().optional().nullable(),
  actionPlan: z.string().optional().nullable(),
  reviewCommittee: z.array(z.any()).optional().nullable(),
  reviewDate: z.string().optional().nullable(),
  reviewerId: z.string().optional().nullable(),
  reviewerName: z.string().optional().nullable(),
  status: z.enum(['PENDING', 'IN_REVIEW', 'COMMITTEE_REVIEW', 'COMPLETED', 'CLOSED']).optional(),
  mAndMPresented: z.boolean().optional(),
  mAndMDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
}).passthrough();

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role, userId }) => {
    if (!canAccessQuality({ email: user?.email, tenantId, role })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { id, ...fields } = parsed.data;

    // Verify record belongs to this tenant
    const existing = await prisma.mortalityReview.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (fields.patientMasterId !== undefined) updateData.patientMasterId = fields.patientMasterId;
    if (fields.encounterId !== undefined) updateData.encounterId = fields.encounterId || null;
    if (fields.episodeId !== undefined) updateData.episodeId = fields.episodeId || null;
    if (fields.dateOfDeath !== undefined) updateData.dateOfDeath = new Date(fields.dateOfDeath);
    if (fields.ageAtDeath !== undefined) updateData.ageAtDeath = fields.ageAtDeath;
    if (fields.gender !== undefined) updateData.gender = fields.gender;
    if (fields.primaryDiagnosis !== undefined) updateData.primaryDiagnosis = fields.primaryDiagnosis;
    if (fields.icdCode !== undefined) updateData.icdCode = fields.icdCode;
    if (fields.secondaryDiagnoses !== undefined) updateData.secondaryDiagnoses = fields.secondaryDiagnoses;
    if (fields.department !== undefined) updateData.department = fields.department;
    if (fields.attendingPhysician !== undefined) updateData.attendingPhysician = fields.attendingPhysician;
    if (fields.admissionDate !== undefined) updateData.admissionDate = fields.admissionDate ? new Date(fields.admissionDate) : null;
    if (fields.deathType !== undefined) updateData.deathType = fields.deathType;
    if (fields.preventability !== undefined) updateData.preventability = fields.preventability;
    if (fields.qualityOfCare !== undefined) updateData.qualityOfCare = fields.qualityOfCare;
    if (fields.delayInDiagnosis !== undefined) updateData.delayInDiagnosis = fields.delayInDiagnosis;
    if (fields.delayInTreatment !== undefined) updateData.delayInTreatment = fields.delayInTreatment;
    if (fields.communicationIssue !== undefined) updateData.communicationIssue = fields.communicationIssue;
    if (fields.handoffIssue !== undefined) updateData.handoffIssue = fields.handoffIssue;
    if (fields.timelineOfCare !== undefined) updateData.timelineOfCare = fields.timelineOfCare;
    if (fields.contributingFactors !== undefined) updateData.contributingFactors = fields.contributingFactors;
    if (fields.systemIssues !== undefined) updateData.systemIssues = fields.systemIssues;
    if (fields.findings !== undefined) updateData.findings = fields.findings;
    if (fields.recommendations !== undefined) updateData.recommendations = fields.recommendations;
    if (fields.lessonsLearned !== undefined) updateData.lessonsLearned = fields.lessonsLearned;
    if (fields.actionPlan !== undefined) updateData.actionPlan = fields.actionPlan;
    if (fields.reviewCommittee !== undefined) updateData.reviewCommittee = fields.reviewCommittee;
    if (fields.reviewDate !== undefined) updateData.reviewDate = fields.reviewDate ? new Date(fields.reviewDate) : null;
    if (fields.reviewerId !== undefined) updateData.reviewerId = fields.reviewerId;
    if (fields.reviewerName !== undefined) updateData.reviewerName = fields.reviewerName;
    if (fields.status !== undefined) updateData.status = fields.status;
    if (fields.mAndMPresented !== undefined) updateData.mAndMPresented = fields.mAndMPresented;
    if (fields.mAndMDate !== undefined) updateData.mAndMDate = fields.mAndMDate ? new Date(fields.mAndMDate) : null;
    if (fields.notes !== undefined) updateData.notes = fields.notes;

    // Auto-calculate length of stay if dates changed
    const finalDeathDate = updateData.dateOfDeath || existing.dateOfDeath;
    const finalAdmissionDate = updateData.admissionDate !== undefined ? updateData.admissionDate : existing.admissionDate;
    if (fields.dateOfDeath !== undefined || fields.admissionDate !== undefined) {
      updateData.lengthOfStay = computeLengthOfStay(finalAdmissionDate as string | Date, finalDeathDate as string | Date);
    }

    // If transitioning to IN_REVIEW and no reviewDate set, auto-set
    if (updateData.status === 'IN_REVIEW' && !existing.reviewDate && !updateData.reviewDate) {
      updateData.reviewDate = new Date();
      updateData.reviewerId = userId || existing.reviewerId;
      updateData.reviewerName = user?.email || existing.reviewerName;
    }

    const updated = await prisma.mortalityReview.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog(
      'mortality_review',
      id,
      'UPDATE',
      userId || 'system',
      user?.email,
      { before: existing, after: updated },
      tenantId
    );

    return NextResponse.json({ success: true, review: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'quality.manage' }
);
