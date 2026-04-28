/**
 * Imdad Budget Governance — Annual Budget Plans
 * خطط الميزانية السنوية
 *
 * GET  /api/imdad/budget-governance/annual-plans — List plans with filters
 * POST /api/imdad/budget-governance/annual-plans — Create new annual plan
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const createSchema = z.object({
  fiscalYear: z.number().int().min(2020).max(2040),
  planCode: z.string().min(1).max(50),
  planName: z.string().min(1).max(200),
  planNameAr: z.string().optional(),
  totalCapitalBudget: z.number().min(0).optional(),
  totalOperationalBudget: z.number().min(0).optional(),
  totalMaintenanceBudget: z.number().min(0).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const organizationId = url.searchParams.get('organizationId');
    const fiscalYear = url.searchParams.get('fiscalYear');
    const status = url.searchParams.get('status');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));

    const where: Record<string, unknown> = { tenantId, isDeleted: false };
    if (organizationId) where.organizationId = organizationId;
    if (fiscalYear) where.fiscalYear = parseInt(fiscalYear);
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.imdadAnnualBudgetPlan.findMany({
        where: where as any,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ fiscalYear: 'desc' }, { createdAt: 'desc' }],
        include: {
          _count: { select: { proposals: true, deviceReplacements: true, investmentPhases: true } },
        } as any,
      }),
      prisma.imdadAnnualBudgetPlan.count({ where: where as any }),
    ]);

    return NextResponse.json({ data: items, total, page, limit });
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

    const organizationId = body.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    try {
      const plan = await prisma.imdadAnnualBudgetPlan.create({
        data: {
          tenantId,
          organizationId,
          fiscalYear: d.fiscalYear,
          planCode: d.planCode,
          planName: d.planName,
          planNameAr: d.planNameAr,
          totalCapitalBudget: d.totalCapitalBudget ?? 0,
          totalOperationalBudget: d.totalOperationalBudget ?? 0,
          totalMaintenanceBudget: d.totalMaintenanceBudget ?? 0,
          metadata: d.metadata as any,
          createdBy: userId,
          updatedBy: userId,
        } as any,
      });

      return NextResponse.json({ data: plan }, { status: 201 });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return NextResponse.json({ error: 'Annual plan already exists for this fiscal year and code' }, { status: 409 });
      }
      console.error('[Budget Governance] Annual plan create error:', err);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'imdad', permissionKey: 'imdad.budget.create' },
);
