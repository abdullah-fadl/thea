/**
 * Imdad Budget Governance — Department Budget Proposals
 * مقترحات ميزانية الأقسام
 *
 * GET  /api/imdad/budget-governance/proposals — List with filters
 * POST /api/imdad/budget-governance/proposals — Create proposal with line items
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const lineItemSchema = z.object({
  itemDescription: z.string().min(1),
  itemDescriptionAr: z.string().optional(),
  itemCode: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  unitCost: z.number().min(0),
  totalCost: z.number().min(0),
  currentAssetTag: z.string().optional(),
  replacesAssetId: z.string().uuid().optional(),
  isReplacement: z.boolean().default(false),
  vendorSuggestion: z.string().optional(),
  leadTimeDays: z.number().int().optional(),
  notes: z.string().optional(),
});

const createSchema = z.object({
  organizationId: z.string().uuid(),
  annualPlanId: z.string().uuid(),
  departmentId: z.string().uuid(),
  departmentName: z.string(),
  departmentNameAr: z.string().optional(),
  proposalCode: z.string().min(1),
  fiscalYear: z.number().int().min(2020).max(2040),
  category: z.enum([
    'CAPITAL_EQUIPMENT', 'OPERATIONAL_SUPPLY', 'MAINTENANCE_CONTRACT',
    'TECHNOLOGY_UPGRADE', 'FACILITY_IMPROVEMENT', 'STAFFING',
    'TRAINING', 'REGULATORY_COMPLIANCE', 'EMERGENCY_RESERVE',
  ]),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'DEFERRED']).default('MEDIUM'),
  title: z.string().min(1),
  titleAr: z.string().optional(),
  description: z.string().min(1),
  descriptionAr: z.string().optional(),
  justification: z.string().optional(),
  justificationAr: z.string().optional(),
  requestedAmount: z.number().min(0),
  previousYearSpend: z.number().min(0).optional(),
  projectedSavings: z.number().min(0).optional(),
  roiPercentage: z.number().optional(),
  clinicalImpactScore: z.number().int().min(0).max(100).optional(),
  riskIfNotApproved: z.string().optional(),
  riskIfNotApprovedAr: z.string().optional(),
  supportingData: z.record(z.string(), z.unknown()).optional(),
  lineItems: z.array(lineItemSchema).optional(),
});

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const organizationId = url.searchParams.get('organizationId');
    const annualPlanId = url.searchParams.get('annualPlanId');
    const departmentId = url.searchParams.get('departmentId');
    const category = url.searchParams.get('category');
    const priority = url.searchParams.get('priority');
    const status = url.searchParams.get('status');
    const fiscalYear = url.searchParams.get('fiscalYear');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));

    const where: Record<string, unknown> = { tenantId, isDeleted: false };
    if (organizationId) where.organizationId = organizationId;
    if (annualPlanId) where.annualPlanId = annualPlanId;
    if (departmentId) where.departmentId = departmentId;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (status) where.status = status;
    if (fiscalYear) where.fiscalYear = parseInt(fiscalYear);

    const [items, total] = await Promise.all([
      prisma.imdadBudgetProposal.findMany({
        where: where as any,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ priority: 'asc' }, { requestedAmount: 'desc' }],
        include: {
          _count: { select: { lineItems: true } },
        } as any,
      }),
      prisma.imdadBudgetProposal.count({ where: where as any }),
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

    try {
      const proposal = await prisma.$transaction(async (tx) => {
        const created = await tx.imdadBudgetProposal.create({
          data: {
            tenantId,
            organizationId: d.organizationId,
            annualPlanId: d.annualPlanId,
            departmentId: d.departmentId,
            departmentName: d.departmentName,
            departmentNameAr: d.departmentNameAr,
            proposalCode: d.proposalCode,
            fiscalYear: d.fiscalYear,
            category: d.category,
            priority: d.priority,
            title: d.title,
            titleAr: d.titleAr,
            description: d.description,
            descriptionAr: d.descriptionAr,
            justification: d.justification,
            justificationAr: d.justificationAr,
            requestedAmount: d.requestedAmount,
            previousYearSpend: d.previousYearSpend,
            projectedSavings: d.projectedSavings,
            roiPercentage: d.roiPercentage,
            clinicalImpactScore: d.clinicalImpactScore,
            riskIfNotApproved: d.riskIfNotApproved,
            riskIfNotApprovedAr: d.riskIfNotApprovedAr,
            supportingData: d.supportingData as any,
            createdBy: userId,
            updatedBy: userId,
          } as any,
        });

        // Create line items
        if (d.lineItems && d.lineItems.length > 0) {
          await tx.imdadProposalLineItem.createMany({
            data: d.lineItems.map((item, idx) => ({
              tenantId,
              organizationId: d.organizationId,
              proposalId: created.id,
              lineNumber: idx + 1,
              itemDescription: item.itemDescription,
              itemDescriptionAr: item.itemDescriptionAr,
              itemCode: item.itemCode,
              quantity: item.quantity,
              unitCost: item.unitCost,
              totalCost: item.totalCost,
              currentAssetTag: item.currentAssetTag,
              replacesAssetId: item.replacesAssetId,
              isReplacement: item.isReplacement,
              vendorSuggestion: item.vendorSuggestion,
              leadTimeDays: item.leadTimeDays,
              notes: item.notes,
            } as any)),
          });
        }

        // Update annual plan totals
        await tx.imdadAnnualBudgetPlan.update({
          where: { id: d.annualPlanId },
          data: {
            totalRequestedAmount: {
              increment: d.requestedAmount,
            },
          },
        });

        return created;
      });

      return NextResponse.json({ data: proposal }, { status: 201 });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return NextResponse.json({ error: 'Proposal code already exists' }, { status: 409 });
      }
      console.error('[Budget Governance] Proposal create error:', err);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'imdad', permissionKey: 'imdad.budget.create' },
);
