import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessQuality } from '@/lib/quality/access';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { IPSG_GOALS, type ActionItem, type IpsgFindingItem } from '@/lib/quality/ipsgDefinitions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const findingsSchema = z.array(
  z.object({
    item: z.string(),
    itemId: z.string(),
    compliant: z.boolean(),
    notes: z.string().optional().default(''),
  })
);

const actionItemSchema = z.object({
  ipsg: z.number().int().min(1).max(6),
  finding: z.string(),
  action: z.string(),
  responsible: z.string().optional().default(''),
  dueDate: z.string().optional().default(''),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE']).default('PENDING'),
});

const createSchema = z.object({
  assessmentDate: z.string().min(1),
  assessorName: z.string().optional(),
  period: z.string().min(1),
  ipsg1Score: z.number().int().min(0).max(100).nullable().optional(),
  ipsg1Findings: findingsSchema.nullable().optional(),
  ipsg2Score: z.number().int().min(0).max(100).nullable().optional(),
  ipsg2Findings: findingsSchema.nullable().optional(),
  ipsg3Score: z.number().int().min(0).max(100).nullable().optional(),
  ipsg3Findings: findingsSchema.nullable().optional(),
  ipsg4Score: z.number().int().min(0).max(100).nullable().optional(),
  ipsg4Findings: findingsSchema.nullable().optional(),
  ipsg5Score: z.number().int().min(0).max(100).nullable().optional(),
  ipsg5Findings: findingsSchema.nullable().optional(),
  ipsg6Score: z.number().int().min(0).max(100).nullable().optional(),
  ipsg6Findings: findingsSchema.nullable().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED']).default('DRAFT'),
  actionItems: z.array(actionItemSchema).nullable().optional(),
  notes: z.string().optional(),
});

const updateSchema = createSchema.partial().extend({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeOverallScore(data: {
  ipsg1Score?: number | null;
  ipsg2Score?: number | null;
  ipsg3Score?: number | null;
  ipsg4Score?: number | null;
  ipsg5Score?: number | null;
  ipsg6Score?: number | null;
}): number | null {
  const scores = [
    data.ipsg1Score,
    data.ipsg2Score,
    data.ipsg3Score,
    data.ipsg4Score,
    data.ipsg5Score,
    data.ipsg6Score,
  ].filter((s): s is number => s != null);

  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/**
 * Auto-extract action items from findings where compliant === false.
 */
function extractActionItemsFromFindings(data: Record<string, unknown>): ActionItem[] {
  const items: ActionItem[] = [];

  for (let i = 1; i <= 6; i++) {
    const findingsKey = `ipsg${i}Findings`;
    const findings = data[findingsKey];
    if (!Array.isArray(findings)) continue;

    for (const f of findings as IpsgFindingItem[]) {
      if (!f.compliant) {
        // Find human-readable name for the checklist item
        const goal = IPSG_GOALS.find((g) => g.number === i);
        const checkItem = goal?.checklistItems.find((c) => c.id === f.itemId);
        items.push({
          ipsg: i,
          finding: f.item || checkItem?.en || f.itemId,
          action: f.notes || `Address non-compliance: ${f.item || f.itemId}`,
          responsible: '',
          dueDate: '',
          status: 'PENDING',
        });
      }
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// GET — List assessments with summary stats
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
    if (!canAccessQuality({ email: user?.email, tenantId, role })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const period = url.searchParams.get('period') || undefined;
    const status = url.searchParams.get('status') || undefined;

    const where: Record<string, unknown> = { tenantId };
    if (period) where.period = period;
    if (status) where.status = status;

    const items = await prisma.ipsgAssessment.findMany({
      where,
      orderBy: { assessmentDate: 'desc' },
      take: 50,
    });

    // Compute summary stats
    const assessments = items as Record<string, unknown>[];
    const totalCount = assessments.length;

    // Per-goal averages
    const goalAverages: Record<string, number | null> = {};
    for (let i = 1; i <= 6; i++) {
      const key = `ipsg${i}Score`;
      const valid = assessments
        .map((a: Record<string, unknown>) => a[key])
        .filter((v: unknown): v is number => typeof v === 'number');
      goalAverages[`ipsg${i}`] = valid.length > 0
        ? Math.round(valid.reduce((a: number, b: number) => a + b, 0) / valid.length)
        : null;
    }

    // Overall average
    const overallScores = assessments
      .map((a: Record<string, unknown>) => a.overallScore)
      .filter((v: unknown): v is number => typeof v === 'number');
    const avgOverall = overallScores.length > 0
      ? Math.round(overallScores.reduce((a: number, b: number) => a + b, 0) / overallScores.length)
      : null;

    // Trend: compare latest 2 assessments
    let trend: 'up' | 'down' | 'stable' | null = null;
    if (assessments.length >= 2) {
      const latest = assessments[0]?.overallScore;
      const previous = assessments[1]?.overallScore;
      if (typeof latest === 'number' && typeof previous === 'number') {
        if (latest > previous) trend = 'up';
        else if (latest < previous) trend = 'down';
        else trend = 'stable';
      }
    }

    // Per-goal trends (latest vs second latest)
    const goalTrends: Record<string, 'up' | 'down' | 'stable' | null> = {};
    for (let i = 1; i <= 6; i++) {
      const key = `ipsg${i}Score`;
      if (assessments.length >= 2) {
        const latest = assessments[0]?.[key];
        const previous = assessments[1]?.[key];
        if (typeof latest === 'number' && typeof previous === 'number') {
          if (latest > previous) goalTrends[`ipsg${i}`] = 'up';
          else if (latest < previous) goalTrends[`ipsg${i}`] = 'down';
          else goalTrends[`ipsg${i}`] = 'stable';
        } else {
          goalTrends[`ipsg${i}`] = null;
        }
      } else {
        goalTrends[`ipsg${i}`] = null;
      }
    }

    // Best & worst performing goals
    const goalEntries = Object.entries(goalAverages)
      .filter(([, v]) => v != null) as [string, number][];
    const bestGoal = goalEntries.length
      ? goalEntries.reduce((a, b) => (a[1] >= b[1] ? a : b))
      : null;
    const worstGoal = goalEntries.length
      ? goalEntries.reduce((a, b) => (a[1] <= b[1] ? a : b))
      : null;

    return NextResponse.json({
      items: assessments,
      summary: {
        totalCount,
        avgOverall,
        goalAverages,
        goalTrends,
        trend,
        bestGoal: bestGoal ? { id: bestGoal[0], score: bestGoal[1] } : null,
        worstGoal: worstGoal ? { id: worstGoal[0], score: worstGoal[1] } : null,
      },
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'quality.view' }
);

// ---------------------------------------------------------------------------
// POST — Create a new assessment
// ---------------------------------------------------------------------------

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role, userId }) => {
    if (!canAccessQuality({ email: user?.email, tenantId, role })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const v = validateBody(body, createSchema);
    if ('error' in v) return v.error;
    const data = v.data;

    const overallScore = computeOverallScore(data);

    // Auto-extract action items from non-compliant findings if none provided
    let actionItems = data.actionItems || null;
    if (!actionItems || (Array.isArray(actionItems) && actionItems.length === 0)) {
      const extracted = extractActionItemsFromFindings(data as Record<string, unknown>);
      if (extracted.length > 0) actionItems = extracted;
    }

    const assessment = await prisma.ipsgAssessment.create({
      data: {
        tenantId,
        assessmentDate: new Date(data.assessmentDate),
        assessorId: userId || 'system',
        assessorName: data.assessorName || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email) || null,
        period: data.period,
        ipsg1Score: data.ipsg1Score ?? null,
        ipsg1Findings: data.ipsg1Findings ?? null,
        ipsg2Score: data.ipsg2Score ?? null,
        ipsg2Findings: data.ipsg2Findings ?? null,
        ipsg3Score: data.ipsg3Score ?? null,
        ipsg3Findings: data.ipsg3Findings ?? null,
        ipsg4Score: data.ipsg4Score ?? null,
        ipsg4Findings: data.ipsg4Findings ?? null,
        ipsg5Score: data.ipsg5Score ?? null,
        ipsg5Findings: data.ipsg5Findings ?? null,
        ipsg6Score: data.ipsg6Score ?? null,
        ipsg6Findings: data.ipsg6Findings ?? null,
        overallScore,
        status: data.status,
        actionItems: actionItems ?? null,
        notes: data.notes || null,
      },
    });

    await createAuditLog(
      'ipsg_assessment',
      assessment.id,
      'CREATE',
      userId || 'system',
      user?.email,
      { after: { id: assessment.id, period: data.period, overallScore, status: data.status } },
      tenantId
    );

    return NextResponse.json({ success: true, id: assessment.id, overallScore });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'quality.manage' }
);

// ---------------------------------------------------------------------------
// PUT — Update an existing assessment
// ---------------------------------------------------------------------------

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role, userId }) => {
    if (!canAccessQuality({ email: user?.email, tenantId, role })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const v = validateBody(body, updateSchema);
    if ('error' in v) return v.error;
    const { id, ...data } = v.data;

    // Verify assessment exists and belongs to tenant
    const existing = await prisma.ipsgAssessment.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Build merged scores for overall recalculation
    const mergedScores = {
      ipsg1Score: data.ipsg1Score !== undefined ? data.ipsg1Score : existing.ipsg1Score,
      ipsg2Score: data.ipsg2Score !== undefined ? data.ipsg2Score : existing.ipsg2Score,
      ipsg3Score: data.ipsg3Score !== undefined ? data.ipsg3Score : existing.ipsg3Score,
      ipsg4Score: data.ipsg4Score !== undefined ? data.ipsg4Score : existing.ipsg4Score,
      ipsg5Score: data.ipsg5Score !== undefined ? data.ipsg5Score : existing.ipsg5Score,
      ipsg6Score: data.ipsg6Score !== undefined ? data.ipsg6Score : existing.ipsg6Score,
    };
    const overallScore = computeOverallScore(mergedScores);

    // Build update payload (only set fields that were provided)
    const updateData: Record<string, unknown> = { overallScore };
    if (data.assessmentDate !== undefined) updateData.assessmentDate = new Date(data.assessmentDate);
    if (data.assessorName !== undefined) updateData.assessorName = data.assessorName;
    if (data.period !== undefined) updateData.period = data.period;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes || null;

    for (let i = 1; i <= 6; i++) {
      const scoreKey = `ipsg${i}Score`;
      const findingsKey = `ipsg${i}Findings`;
      if ((data as Record<string, unknown>)[scoreKey] !== undefined) updateData[scoreKey] = (data as Record<string, unknown>)[scoreKey];
      if ((data as Record<string, unknown>)[findingsKey] !== undefined) updateData[findingsKey] = (data as Record<string, unknown>)[findingsKey];
    }

    // Handle action items
    if (data.actionItems !== undefined) {
      updateData.actionItems = data.actionItems;
    } else {
      // Re-extract if findings changed and no explicit action items
      const hasNewFindings = Object.keys(data).some((k) => k.endsWith('Findings'));
      if (hasNewFindings) {
        const mergedData: Record<string, unknown> = {};
        for (let i = 1; i <= 6; i++) {
          const fk = `ipsg${i}Findings`;
          mergedData[fk] = (data as Record<string, unknown>)[fk] !== undefined ? (data as Record<string, unknown>)[fk] : (existing as Record<string, unknown>)[fk];
        }
        const extracted = extractActionItemsFromFindings(mergedData);
        if (extracted.length > 0) {
          // Merge with existing action items — keep completed ones, add new pending
          const existingActions: ActionItem[] = Array.isArray(existing.actionItems)
            ? existing.actionItems as any
            : [];
          const completedActions = existingActions.filter(
            (a: ActionItem) => a.status === 'COMPLETED'
          );
          updateData.actionItems = [...completedActions, ...extracted];
        }
      }
    }

    const updated = await prisma.ipsgAssessment.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog(
      'ipsg_assessment',
      id,
      'UPDATE',
      userId || 'system',
      user?.email,
      {
        before: { overallScore: existing.overallScore, status: existing.status },
        after: { overallScore, status: updated.status },
      },
      tenantId
    );

    return NextResponse.json({ success: true, id: updated.id, overallScore });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'quality.manage' }
);
