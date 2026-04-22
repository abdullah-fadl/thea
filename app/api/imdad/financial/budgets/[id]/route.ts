/**
 * SCM BC4 Financial — Budget Detail
 *
 * GET   /api/imdad/financial/budgets/[id] — Single budget with lines and consumption
 * PUT   /api/imdad/financial/budgets/[id] — Update budget (DRAFT only, optimistic locking)
 * PATCH /api/imdad/financial/budgets/[id] — Status transitions (submit/approve/freeze/close)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — Single budget with lines and consumption summary
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }, params) => {
    const { id } = (await params) as { id: string };

    const budget = await prisma.imdadBudget.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: {
        lines: { where: { isDeleted: false }, orderBy: { lineNumber: 'asc' } },
        costCenter: true,
      } as any,
    });

    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    // Consumption summary
    const consumptionAgg = await prisma.imdadBudgetConsumption.aggregate({
      where: { tenantId, budgetId: id, isDeleted: false, isReversal: false },
      _sum: { amount: true },
      _count: true,
    });

    return NextResponse.json({
      budget,
      consumptionSummary: {
        totalConsumed: consumptionAgg._sum.amount || 0,
        transactionCount: consumptionAgg._count,
      },
    });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.financial.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update budget (DRAFT only, optimistic locking)
// ---------------------------------------------------------------------------
const updateBudgetSchema = z.object({
  version: z.number().int(),
  budgetName: z.string().min(1).optional(),
  budgetNameAr: z.string().optional(),
  periodType: z.enum(['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'PROJECT']).optional(),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  costCenterId: z.string().uuid().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  categoryCode: z.string().nullable().optional(),
  allocatedAmount: z.number().min(0).optional(),
  warningThreshold: z.number().min(0).max(100).optional(),
  criticalThreshold: z.number().min(0).max(100).optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    const { id } = (await params) as { id: string };

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updateBudgetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const existing = await prisma.imdadBudget.findFirst({
      where: { id, tenantId, isDeleted: false },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only DRAFT budgets can be updated' },
        { status: 409 }
      );
    }

    if (existing.version !== data.version) {
      return NextResponse.json(
        { error: 'Optimistic locking conflict — budget was modified by another user' },
        { status: 409 }
      );
    }

    // Explicit field picking — prevent mass assignment (no spread of user data)
    const updateData: any = {
      updatedBy: userId,
      version: { increment: 1 },
    };

    if (data.budgetName !== undefined) updateData.budgetName = data.budgetName;
    if (data.budgetNameAr !== undefined) updateData.budgetNameAr = data.budgetNameAr;
    if (data.periodType !== undefined) updateData.periodType = data.periodType;
    if (data.periodStart !== undefined) updateData.periodStart = new Date(data.periodStart);
    if (data.periodEnd !== undefined) updateData.periodEnd = new Date(data.periodEnd);
    if (data.costCenterId !== undefined) updateData.costCenterId = data.costCenterId;
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
    if (data.categoryCode !== undefined) updateData.categoryCode = data.categoryCode;
    if (data.allocatedAmount !== undefined) updateData.allocatedAmount = data.allocatedAmount;
    if (data.warningThreshold !== undefined) updateData.warningThreshold = data.warningThreshold;
    if (data.criticalThreshold !== undefined) updateData.criticalThreshold = data.criticalThreshold;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.notes !== undefined) updateData.notes = data.notes;
    // NOTE: metadata intentionally excluded — z.any() allows arbitrary data

    // Recalculate availableAmount if allocatedAmount changed
    if (data.allocatedAmount !== undefined) {
      updateData.adjustedAmount = data.allocatedAmount;
      updateData.availableAmount =
        data.allocatedAmount -
        Number(existing.consumedAmount) -
        Number(existing.committedAmount);
    }

    try {
      const updated = await prisma.imdadBudget.update({
        where: { id, version: existing.version },
        data: updateData,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId,
        actorUserId: userId,
        action: 'UPDATE',
        resourceType: 'budget',
        resourceId: id,
        boundedContext: 'BC4_FINANCIAL',
        previousData: existing as any,
        newData: updated as any,
        request: req,
      });

      return NextResponse.json({ budget: updated });
    } catch (error: any) {
      if (error?.code === 'P2025') {
        return NextResponse.json(
          { error: 'Optimistic locking conflict' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.financial.budget.edit' }
);

// ---------------------------------------------------------------------------
// PATCH — Status transitions
// ---------------------------------------------------------------------------
const patchBudgetSchema = z.object({
  action: z.enum(['submit', 'approve', 'freeze', 'close']),
  version: z.number().int(),
  notes: z.string().optional(),
});

const TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  submit: { from: ['DRAFT'], to: 'SUBMITTED' },
  approve: { from: ['SUBMITTED'], to: 'ACTIVE' },
  freeze: { from: ['ACTIVE'], to: 'FROZEN' },
  close: { from: ['ACTIVE', 'FROZEN'], to: 'CLOSED' },
};

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    const { id } = (await params) as { id: string };

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = patchBudgetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { action, notes } = parsed.data;
    const transition = TRANSITIONS[action];

    const existing = await prisma.imdadBudget.findFirst({
      where: { id, tenantId, isDeleted: false },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    if (existing.version !== parsed.data.version) {
      return NextResponse.json(
        { error: 'Conflict', message: 'Record was modified by another user. Please refresh and try again.' },
        { status: 409 }
      );
    }

    if (!transition.from.includes(existing.status)) {
      return NextResponse.json(
        {
          error: `Cannot ${action} budget in ${existing.status} status. Allowed from: ${transition.from.join(', ')}`,
        },
        { status: 409 }
      );
    }

    const updateData: any = {
      status: transition.to,
      version: { increment: 1 },
      updatedBy: userId,
    };

    if (action === 'approve') {
      updateData.approvedBy = userId;
      updateData.approvedAt = new Date();
    }

    if (notes) {
      updateData.notes = notes;
    }

    const updated = await prisma.imdadBudget.update({
      where: { id },
      data: updateData,
    });

    await imdadAudit.log({
      tenantId,
      organizationId: existing.organizationId,
      actorUserId: userId,
      action: 'APPROVE',
      resourceType: 'budget',
      resourceId: id,
      boundedContext: 'BC4_FINANCIAL',
      previousData: { status: existing.status },
      newData: { status: updated.status, action },
      request: req,
    });

    return NextResponse.json({ budget: updated });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.financial.budget.approve' }
);
