/**
 * SCM Approval — Workflow Rules
 *
 * GET  /api/imdad/approval/workflows/:id/rules — List rules for a workflow
 * POST /api/imdad/approval/workflows/:id/rules — Add rule with steps (nested create)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

function extractWorkflowId(url: string): string {
  const segments = url.split('/');
  const idx = segments.indexOf('workflows');
  return segments[idx + 1];
}

// ---------------------------------------------------------------------------
// GET — List rules for a workflow template
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const templateId = extractWorkflowId(req.nextUrl.pathname);

      const workflow = await prisma.imdadApprovalWorkflowTemplate.findFirst({
        where: { id: templateId, tenantId, isDeleted: false },
      });

      if (!workflow) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }

      const rules = await prisma.imdadApprovalWorkflowRule.findMany({
        where: { templateId, tenantId, isDeleted: false },
        orderBy: { ruleOrder: 'asc' },
        include: { steps: { orderBy: { stepNumber: 'asc' } as any } } as any,
        take: 100,
      });

      return NextResponse.json({ data: rules, total: rules.length });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.approval.workflows.list' }
);

// ---------------------------------------------------------------------------
// POST — Add rule with nested steps
// ---------------------------------------------------------------------------

const stepSchema = z.object({
  stepNumber: z.number().int().min(1),
  approverType: z.string().min(1),
  approverUserId: z.string().uuid().optional(),
  approverRoleKey: z.string().optional(),
  canDelegate: z.boolean().default(false),
  timeoutHours: z.number().min(0).optional(),
  escalateToUserId: z.string().uuid().optional(),
  escalateToRoleKey: z.string().optional(),
});

const createRuleSchema = z.object({
  name: z.string().min(1).max(255),
  nameAr: z.string().optional(),
  priority: z.number().int().min(0).default(0),
  conditionType: z.string().min(1),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
  currency: z.string().default('SAR'),
  metadata: z.record(z.string(), z.any()).optional(),
  steps: z.array(stepSchema).min(1),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const templateId = extractWorkflowId(req.nextUrl.pathname);

      const workflow = await prisma.imdadApprovalWorkflowTemplate.findFirst({
        where: { id: templateId, tenantId, isDeleted: false },
      });

      if (!workflow) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }

      const body = await req.json();
      const parsed = createRuleSchema.parse(body);
      const { steps, ...ruleData } = parsed;

      // Get next ruleOrder for this template
      const lastRule = await prisma.imdadApprovalWorkflowRule.findFirst({
        where: { templateId, tenantId, isDeleted: false },
        orderBy: { ruleOrder: 'desc' },
        select: { ruleOrder: true },
      });
      const nextOrder = (lastRule?.ruleOrder ?? 0) + 1;

      const rule = await prisma.imdadApprovalWorkflowRule.create({
        data: {
          tenantId,
          organizationId: workflow.organizationId,
          templateId,
          ruleOrder: ruleData.priority ?? nextOrder,
          minAmount: ruleData.minAmount ?? 0,
          maxAmount: ruleData.maxAmount,
          currency: ruleData.currency,
          autoApprove: false,
          steps: {
            create: steps.map((s) => ({
              tenantId,
              stepNumber: s.stepNumber,
              approverType: s.approverType as any,
              approverUserId: s.approverUserId,
              approverRoleKey: s.approverRoleKey,
              canDelegate: s.canDelegate,
              timeoutHours: s.timeoutHours,
              escalateToUserId: s.escalateToUserId,
              escalateToRoleKey: s.escalateToRoleKey,
            })),
          },
        } as any,
        include: { steps: { orderBy: { stepNumber: 'asc' } as any } } as any,
      });

      // Attach metadata for response (not stored in DB but included in response for client use)
      const ruleResponse = { ...rule, name: ruleData.name, nameAr: ruleData.nameAr };

      await imdadAudit.log({
        tenantId,
        organizationId: workflow.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'approval_rule',
        resourceId: rule.id,
        boundedContext: 'BC8_APPROVAL',
        newData: ruleResponse as any,
        request: req,
      });

      return NextResponse.json({ data: ruleResponse }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.approval.workflows.create' }
);
