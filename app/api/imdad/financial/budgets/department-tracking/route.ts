/**
 * SCM BC4 Financial — Budget Tracking per Department
 *
 * GET  /api/imdad/financial/budgets/department-tracking — Budget utilization per department
 * POST /api/imdad/financial/budgets/department-tracking — Record budget expenditure
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Budget utilization summary per department
// ---------------------------------------------------------------------------

const querySchema = z.object({
  organizationId: z.string().uuid().optional(),
  fiscalYear: z.coerce.number().int().optional(),
  departmentId: z.string().uuid().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = querySchema.parse(params);
      const { organizationId, fiscalYear, departmentId } = parsed;
      const year = fiscalYear || new Date().getFullYear();

      // 1. Fetch budgets grouped by cost center (department)
      const budgetWhere: any = {
        tenantId,
        isDeleted: false,
        fiscalYear: year,
      };
      if (organizationId) budgetWhere.organizationId = organizationId;

      const budgets = await prisma.imdadBudget.findMany({
        where: budgetWhere,
        include: {
          costCenter: { select: { id: true, name: true, nameAr: true, code: true, parentId: true } },
        } as any,
        take: 1000,
      });

      // 2. Fetch invoices for spend calculation
      const invoiceWhere: any = {
        tenantId,
        isDeleted: false,
        status: { in: ['APPROVED', 'PAID', 'PARTIALLY_PAID'] },
        invoiceDate: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
      };
      if (organizationId) invoiceWhere.organizationId = organizationId;

      const invoices = await prisma.imdadInvoice.findMany({
        where: invoiceWhere,
        select: {
          costCenterId: true,
          totalAmount: true,
          paidAmount: true,
          status: true,
        } as any,
        take: 1000,
      });

      // 3. Fetch POs for committed spend
      const poWhere: any = {
        tenantId,
        isDeleted: false,
        status: { in: ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] },
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
      };
      if (organizationId) poWhere.organizationId = organizationId;

      const purchaseOrders = await prisma.imdadPurchaseOrder.findMany({
        where: poWhere,
        select: {
          costCenterId: true,
          totalAmount: true,
          status: true,
        },
        take: 1000,
      });

      // 4. Aggregate per department/cost center
      const departmentMap = new Map<string, {
        costCenter: any;
        budgetAllocated: number;
        budgetAvailable: number;
        actualSpend: number;
        committedSpend: number;
        paidAmount: number;
      }>();

      for (const budget of budgets) {
        const ccId = budget.costCenterId || 'UNASSIGNED';
        const existing = departmentMap.get(ccId) || {
          costCenter: (budget as any).costCenter || { id: ccId, name: 'Unassigned', code: 'N/A' },
          budgetAllocated: 0,
          budgetAvailable: 0,
          actualSpend: 0,
          committedSpend: 0,
          paidAmount: 0,
        };
        existing.budgetAllocated += Number((budget as any).allocatedAmount ?? 0);
        existing.budgetAvailable += Number((budget as any).availableAmount ?? (budget as any).allocatedAmount ?? 0);
        departmentMap.set(ccId, existing);
      }

      // Add invoice spend
      for (const inv of invoices) {
        const ccId = (inv as any).costCenterId || 'UNASSIGNED';
        const existing = departmentMap.get(ccId);
        if (existing) {
          existing.actualSpend += Number(inv.totalAmount ?? 0);
          existing.paidAmount += Number(inv.paidAmount ?? 0);
        }
      }

      // Add committed PO spend
      for (const po of purchaseOrders) {
        const ccId = (po as any).costCenterId || 'UNASSIGNED';
        const existing = departmentMap.get(ccId);
        if (existing) {
          existing.committedSpend += Number(po.totalAmount ?? 0);
        }
      }

      // 5. Build response with utilization metrics
      const departments = Array.from(departmentMap.entries())
        .filter(([id]) => !departmentId || id === departmentId)
        .map(([id, dept]) => {
          const utilization = dept.budgetAllocated > 0
            ? Math.round((dept.actualSpend / dept.budgetAllocated) * 100 * 10) / 10
            : 0;
          const committedUtilization = dept.budgetAllocated > 0
            ? Math.round(((dept.actualSpend + dept.committedSpend) / dept.budgetAllocated) * 100 * 10) / 10
            : 0;
          const remainingBudget = dept.budgetAllocated - dept.actualSpend - dept.committedSpend;

          let status: string;
          if (committedUtilization > 100) status = 'OVER_BUDGET';
          else if (committedUtilization >= 90) status = 'CRITICAL';
          else if (committedUtilization >= 75) status = 'WARNING';
          else status = 'HEALTHY';

          return {
            costCenterId: id,
            costCenter: dept.costCenter,
            budgetAllocated: Math.round(dept.budgetAllocated * 100) / 100,
            actualSpend: Math.round(dept.actualSpend * 100) / 100,
            committedSpend: Math.round(dept.committedSpend * 100) / 100,
            paidAmount: Math.round(dept.paidAmount * 100) / 100,
            remainingBudget: Math.round(remainingBudget * 100) / 100,
            utilization,
            committedUtilization,
            status,
          };
        })
        .sort((a, b) => b.committedUtilization - a.committedUtilization);

      // 6. Organization totals
      const totals = departments.reduce(
        (acc, d) => ({
          totalAllocated: acc.totalAllocated + d.budgetAllocated,
          totalActualSpend: acc.totalActualSpend + d.actualSpend,
          totalCommitted: acc.totalCommitted + d.committedSpend,
          totalRemaining: acc.totalRemaining + d.remainingBudget,
        }),
        { totalAllocated: 0, totalActualSpend: 0, totalCommitted: 0, totalRemaining: 0 }
      );

      const overallUtilization = totals.totalAllocated > 0
        ? Math.round((totals.totalActualSpend / totals.totalAllocated) * 100 * 10) / 10
        : 0;

      return NextResponse.json({
        data: departments,
        totals: {
          ...totals,
          overallUtilization,
          departmentCount: departments.length,
          overBudget: departments.filter(d => d.status === 'OVER_BUDGET').length,
          critical: departments.filter(d => d.status === 'CRITICAL').length,
        },
        fiscalYear: year,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.financial.view' }
);

// ---------------------------------------------------------------------------
// POST — Record a budget expenditure / adjustment against a department
// ---------------------------------------------------------------------------

const expenditureSchema = z.object({
  organizationId: z.string().uuid(),
  budgetId: z.string().uuid(),
  costCenterId: z.string().uuid(),
  amount: z.number().positive(),
  expenditureType: z.enum(['PO_COMMITMENT', 'INVOICE_ACTUAL', 'ADJUSTMENT', 'RELEASE']),
  referenceType: z.string().optional(),
  referenceId: z.string().uuid().optional(),
  description: z.string().min(1),
  descriptionAr: z.string().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = expenditureSchema.parse(body);

      // Verify budget exists
      const budget = await prisma.imdadBudget.findFirst({
        where: { id: parsed.budgetId, tenantId, isDeleted: false },
      });
      if (!budget) {
        return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
      }

      const currentAvailable = Number((budget as any).availableAmount ?? 0);
      const isDebit = ['PO_COMMITMENT', 'INVOICE_ACTUAL'].includes(parsed.expenditureType);
      const delta = isDebit ? -parsed.amount : parsed.amount;
      const newAvailable = currentAvailable + delta;

      if (isDebit && newAvailable < 0) {
        return NextResponse.json(
          {
            error: 'Insufficient budget',
            available: currentAvailable,
            requested: parsed.amount,
          },
          { status: 400 }
        );
      }

      // Update budget available amount
      await prisma.imdadBudget.update({
        where: { id: parsed.budgetId },
        data: {
          availableAmount: newAvailable,
          updatedBy: userId,
          version: { increment: 1 },
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: isDebit ? 'DEBIT' : 'CREDIT',
        resourceType: 'BUDGET_EXPENDITURE',
        resourceId: parsed.budgetId,
        boundedContext: 'BC4_FINANCIAL',
        previousData: { availableAmount: currentAvailable },
        newData: {
          availableAmount: newAvailable,
          amount: parsed.amount,
          expenditureType: parsed.expenditureType,
          description: parsed.description,
          referenceType: parsed.referenceType,
          referenceId: parsed.referenceId,
        },
        request: req,
      });

      return NextResponse.json({
        data: {
          budgetId: parsed.budgetId,
          previousAvailable: currentAvailable,
          newAvailable,
          delta,
          expenditureType: parsed.expenditureType,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.financial.budget.manage' }
);
