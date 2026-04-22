/**
 * Imdad Budget Governance — Single Annual Budget Plan
 *
 * GET    /api/imdad/budget-governance/annual-plans/[id] — Get plan with proposals, device plans, investments
 * PATCH  /api/imdad/budget-governance/annual-plans/[id] — Update plan / change status
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const updateSchema = z.object({
  planName: z.string().optional(),
  planNameAr: z.string().optional(),
  status: z.enum([
    'DRAFT', 'DEPARTMENT_REVIEW', 'HOSPITAL_REVIEW', 'CORPORATE_REVIEW',
    'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'FINALIZED',
  ]).optional(),
  totalCapitalBudget: z.number().min(0).optional(),
  totalOperationalBudget: z.number().min(0).optional(),
  totalMaintenanceBudget: z.number().min(0).optional(),
  totalApprovedAmount: z.number().min(0).optional(),
  totalAllocatedAmount: z.number().min(0).optional(),
  corporateNotes: z.string().optional(),
  corporateNotesAr: z.string().optional(),
  aiSummary: z.string().optional(),
  aiSummaryAr: z.string().optional(),
  aiRiskScore: z.number().min(0).max(100).optional(),
  aiOptimizationSavings: z.number().min(0).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const GET = withAuthTenant(
  async (_req: NextRequest, { tenantId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = (resolvedParams as any)?.id as string;

    const plan = await prisma.imdadAnnualBudgetPlan.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: {
        proposals: {
          where: { isDeleted: false },
          orderBy: [{ priority: 'asc' }, { requestedAmount: 'desc' }],
          include: { lineItems: { where: { isDeleted: false }, orderBy: { lineNumber: 'asc' } } },
        },
        deviceReplacements: {
          where: { isDeleted: false },
          orderBy: [{ replacementUrgency: 'asc' }, { aiRiskScore: 'desc' }],
        },
        investmentPhases: {
          where: { isDeleted: false },
          orderBy: [{ phaseYear: 'asc' }, { phase: 'asc' }],
        },
        benchmarks: {
          where: { isDeleted: false },
          orderBy: { metric: 'asc' },
        },
      } as any,
    });

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Compute aggregated stats
    const totalRequested = (plan as any).proposals.reduce(
      (sum, p) => sum + Number(p.requestedAmount), 0,
    );
    const totalApprovedFromProposals = (plan as any).proposals
      .filter(p => p.approvedAmount != null)
      .reduce((sum, p) => sum + Number(p.approvedAmount), 0);
    const criticalDevices = (plan as any).deviceReplacements.filter(
      d => d.replacementUrgency === 'IMMEDIATE' || d.patientSafetyRisk,
    ).length;
    const totalInvestmentCost = (plan as any).investmentPhases.reduce(
      (sum, i) => sum + Number(i.phaseAmount), 0,
    );

    return NextResponse.json({
      data: plan,
      stats: {
        totalProposals: (plan as any).proposals.length,
        totalRequested,
        totalApprovedFromProposals,
        criticalDeviceReplacements: criticalDevices,
        totalDeviceReplacements: (plan as any).deviceReplacements.length,
        totalInvestmentPhases: (plan as any).investmentPhases.length,
        totalInvestmentCost,
        benchmarkCount: (plan as any).benchmarks.length,
      },
    });
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

    const existing = await prisma.imdadAnnualBudgetPlan.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const updateData: any = { ...parsed.data, updatedBy: userId };

    // Auto-set timestamps on status changes
    if (parsed.data.status === 'DEPARTMENT_REVIEW' || parsed.data.status === 'HOSPITAL_REVIEW' || parsed.data.status === 'CORPORATE_REVIEW') {
      updateData.submittedAt = new Date();
      updateData.submittedBy = userId;
    }
    if (parsed.data.status === 'APPROVED' || parsed.data.status === 'PARTIALLY_APPROVED') {
      updateData.approvedAt = new Date();
      updateData.approvedBy = userId;
    }

    const updated = await prisma.imdadAnnualBudgetPlan.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: updated });
  },
  { tenantScoped: true, platformKey: 'imdad', permissionKey: 'imdad.budget.approve' },
);
