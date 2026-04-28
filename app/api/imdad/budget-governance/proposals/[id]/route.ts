/**
 * Imdad Budget Governance — Single Proposal Actions
 *
 * GET   /api/imdad/budget-governance/proposals/[id] — Get full proposal with line items
 * PATCH /api/imdad/budget-governance/proposals/[id] — Update/approve/reject
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const updateSchema = z.object({
  status: z.enum([
    'DRAFT', 'DEPARTMENT_REVIEW', 'HOSPITAL_REVIEW', 'CORPORATE_REVIEW',
    'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'FINALIZED',
  ]).optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'DEFERRED']).optional(),
  approvedAmount: z.number().min(0).optional(),
  reviewerNotes: z.string().optional(),
  reviewerNotesAr: z.string().optional(),
  aiRecommendation: z.string().optional(),
  aiRecommendationAr: z.string().optional(),
  aiAnomalyFlags: z.record(z.string(), z.unknown()).optional(),
  aiAlternatives: z.record(z.string(), z.unknown()).optional(),
});

export const GET = withAuthTenant(
  async (_req: NextRequest, { tenantId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = (resolvedParams as any)?.id as string;

    const proposal = await prisma.imdadBudgetProposal.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: {
        lineItems: { where: { isDeleted: false }, orderBy: { lineNumber: 'asc' } },
        annualPlan: { select: { planName: true, planNameAr: true, fiscalYear: true, status: true } },
      } as any,
    });

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    return NextResponse.json({ data: proposal });
  },
  { tenantScoped: true, platformKey: 'imdad', permissionKey: 'imdad.budget.view' },
);

export const PATCH = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = (resolvedParams as any)?.id as string;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.imdadBudgetProposal.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const updateData: any = { ...parsed.data, updatedBy: userId };

    if (parsed.data.status === 'APPROVED' || parsed.data.status === 'PARTIALLY_APPROVED') {
      updateData.approvedAt = new Date();
      updateData.approvedBy = userId;
    }
    if (parsed.data.status === 'DEPARTMENT_REVIEW' || parsed.data.status === 'HOSPITAL_REVIEW') {
      updateData.submittedAt = new Date();
      updateData.submittedBy = userId;
    }

    const updated = await prisma.imdadBudgetProposal.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: updated });
  },
  { tenantScoped: true, platformKey: 'imdad', permissionKey: 'imdad.budget.approve' },
);
