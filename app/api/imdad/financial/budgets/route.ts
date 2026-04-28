/**
 * SCM BC4 Financial — Budgets
 *
 * GET  /api/imdad/financial/budgets — List budgets with pagination and filters
 * POST /api/imdad/financial/budgets — Create a new budget in DRAFT status
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List ImdadBudget
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const fiscalYear = url.searchParams.get('fiscalYear')
      ? parseInt(url.searchParams.get('fiscalYear')!, 10)
      : undefined;
    const costCenterId = url.searchParams.get('costCenterId') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const organizationId = url.searchParams.get('organizationId') || undefined;

    const where: any = { tenantId, isDeleted: false };

    if (organizationId) where.organizationId = organizationId;
    if (fiscalYear) where.fiscalYear = fiscalYear;
    if (costCenterId) where.costCenterId = costCenterId;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.imdadBudget.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { costCenter: true } as any,
      }),
      prisma.imdadBudget.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.financial.view' }
);

// ---------------------------------------------------------------------------
// POST — Create ImdadBudget
// ---------------------------------------------------------------------------
const createBudgetSchema = z.object({
  organizationId: z.string().uuid(),
  budgetCode: z.string().min(1),
  budgetName: z.string().min(1),
  budgetNameAr: z.string().optional(),
  fiscalYear: z.number().int(),
  periodType: z.enum(['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'PROJECT']),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  costCenterId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  categoryCode: z.string().optional(),
  allocatedAmount: z.number().min(0),
  warningThreshold: z.number().min(0).max(100).optional(),
  criticalThreshold: z.number().min(0).max(100).optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createBudgetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    try {
      const budget = await prisma.imdadBudget.create({
        data: {
          tenantId,
          organizationId: data.organizationId,
          budgetCode: data.budgetCode,
          budgetName: data.budgetName,
          budgetNameAr: data.budgetNameAr,
          fiscalYear: data.fiscalYear,
          periodType: data.periodType,
          periodStart: new Date(data.periodStart),
          periodEnd: new Date(data.periodEnd),
          costCenterId: data.costCenterId,
          departmentId: data.departmentId,
          categoryCode: data.categoryCode,
          allocatedAmount: data.allocatedAmount,
          adjustedAmount: data.allocatedAmount,
          availableAmount: data.allocatedAmount,
          warningThreshold: data.warningThreshold,
          criticalThreshold: data.criticalThreshold,
          currency: data.currency,
          notes: data.notes,
          metadata: data.metadata,
          status: 'DRAFT',
          createdBy: userId,
          updatedBy: userId,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: data.organizationId,
        actorUserId: userId,
        action: 'CREATE',
        resourceType: 'budget',
        resourceId: budget.id,
        boundedContext: 'BC4_FINANCIAL',
        newData: budget as any,
        request: req,
      });

      return NextResponse.json({ budget }, { status: 201 });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return NextResponse.json(
          { error: 'Budget code already exists for this organization' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.financial.budget.create' }
);
