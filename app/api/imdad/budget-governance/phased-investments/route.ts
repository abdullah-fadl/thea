/**
 * Imdad Budget Governance — Phased Investment Plans
 * خطط الاستثمار المرحلية
 *
 * GET  /api/imdad/budget-governance/phased-investments — List phased plans
 * POST /api/imdad/budget-governance/phased-investments — Create phased investment
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const createSchema = z.object({
  organizationId: z.string().uuid(),
  annualPlanId: z.string().uuid(),
  investmentCode: z.string().min(1),
  investmentName: z.string().min(1),
  investmentNameAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  totalInvestment: z.number().min(0),
  phase: z.enum(['PHASE_1', 'PHASE_2', 'PHASE_3', 'SINGLE_PHASE']).default('PHASE_1'),
  phaseYear: z.number().int().min(2020).max(2040),
  phaseAmount: z.number().min(0),
  cumulativeSpend: z.number().min(0).default(0),
  totalPhases: z.number().int().min(1).max(5).default(1),
  itemsInPhase: z.number().int().min(0).default(0),
  totalItems: z.number().int().min(0).default(0),
  priorityScore: z.number().min(0).max(100).optional(),
  riskScore: z.number().min(0).max(100).optional(),
  departmentId: z.string().uuid().optional(),
  departmentName: z.string().optional(),
  assetCategory: z.string().optional(),
  aiJustification: z.string().optional(),
  aiJustificationAr: z.string().optional(),
  costDistribution: z.record(z.string(), z.unknown()).optional(),
  milestones: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const organizationId = url.searchParams.get('organizationId');
    const annualPlanId = url.searchParams.get('annualPlanId');
    const phase = url.searchParams.get('phase');
    const phaseYear = url.searchParams.get('phaseYear');
    const status = url.searchParams.get('status');

    const where: Record<string, unknown> = { tenantId, isDeleted: false };
    if (organizationId) where.organizationId = organizationId;
    if (annualPlanId) where.annualPlanId = annualPlanId;
    if (phase) where.phase = phase;
    if (phaseYear) where.phaseYear = parseInt(phaseYear);
    if (status) where.status = status;

    const items = await prisma.imdadPhasedInvestment.findMany({
      where: where as any,
      orderBy: [{ phaseYear: 'asc' }, { phase: 'asc' }, { priorityScore: 'desc' }],
      take: 200,
    });

    // Aggregate by year for timeline view
    const byYear = new Map<number, { count: number; totalAmount: number; items: number }>();
    for (const item of items) {
      const yr = item.phaseYear;
      const existing = byYear.get(yr) || { count: 0, totalAmount: 0, items: 0 };
      existing.count++;
      existing.totalAmount += Number(item.phaseAmount);
      existing.items += item.itemsInPhase;
      byYear.set(yr, existing);
    }

    const timeline = Array.from(byYear.entries())
      .sort(([a], [b]) => a - b)
      .map(([year, data]) => ({ year, ...data }));

    return NextResponse.json({
      data: items,
      timeline,
      summary: {
        totalInvestments: items.length,
        totalAmount: items.reduce((s, i) => s + Number(i.phaseAmount), 0),
        totalItems: items.reduce((s, i) => s + i.itemsInPhase, 0),
        yearSpan: timeline.length > 0 ? `${timeline[0].year}-${timeline[timeline.length - 1].year}` : '-',
      },
    });
  },
  { tenantScoped: true, platformKey: 'imdad', permissionKey: 'imdad.budget.view' },
);

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    try {
      const investment = await prisma.imdadPhasedInvestment.create({
        data: {
          tenantId,
          organizationId: d.organizationId,
          annualPlanId: d.annualPlanId,
          investmentCode: d.investmentCode,
          investmentName: d.investmentName,
          investmentNameAr: d.investmentNameAr,
          description: d.description,
          descriptionAr: d.descriptionAr,
          totalInvestment: d.totalInvestment,
          phase: d.phase,
          phaseYear: d.phaseYear,
          phaseAmount: d.phaseAmount,
          cumulativeSpend: d.cumulativeSpend,
          totalPhases: d.totalPhases,
          itemsInPhase: d.itemsInPhase,
          totalItems: d.totalItems,
          priorityScore: d.priorityScore,
          riskScore: d.riskScore,
          departmentId: d.departmentId,
          departmentName: d.departmentName,
          assetCategory: d.assetCategory,
          aiJustification: d.aiJustification,
          aiJustificationAr: d.aiJustificationAr,
          costDistribution: d.costDistribution as any,
          milestones: d.milestones as any,
          createdBy: userId,
          updatedBy: userId,
        } as any,
      });

      return NextResponse.json({ data: investment }, { status: 201 });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return NextResponse.json({ error: 'Investment code already exists' }, { status: 409 });
      }
      console.error('[Phased Investment] Create error:', err);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'imdad', permissionKey: 'imdad.budget.create' },
);
