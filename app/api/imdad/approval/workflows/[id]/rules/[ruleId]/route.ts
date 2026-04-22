/**
 * SCM Approval — Single Workflow Rule
 *
 * PUT    /api/imdad/approval/workflows/:id/rules/:ruleId — Update rule
 * DELETE /api/imdad/approval/workflows/:id/rules/:ruleId — Soft delete rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

function extractIds(pathname: string) {
  const segments = pathname.split('/');
  const wIdx = segments.indexOf('workflows');
  const rIdx = segments.indexOf('rules');
  return { templateId: segments[wIdx + 1], ruleId: segments[rIdx + 1] };
}

// ---------------------------------------------------------------------------
// PUT — Update rule
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

const updateRuleSchema = z.object({
  version: z.number().int(),
  name: z.string().min(1).max(255).optional(),
  nameAr: z.string().optional(),
  priority: z.number().int().min(0).optional(),
  conditionType: z.string().optional(),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
  currency: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  steps: z.array(stepSchema).optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const { templateId, ruleId } = extractIds(req.nextUrl.pathname);
      const body = await req.json();
      const parsed = updateRuleSchema.parse(body);

      const { version, steps, ...updates } = parsed;

      const existing = await prisma.imdadApprovalWorkflowRule.findFirst({
        where: { id: ruleId, templateId, tenantId, isDeleted: false },
        include: { steps: true } as any,
      });

      if (!existing) {
        return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — rule was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      // If steps are provided, replace all steps
      if (steps) {
        await prisma.imdadApprovalWorkflowRuleStep.deleteMany({ where: { ruleId } });
        await prisma.imdadApprovalWorkflowRuleStep.createMany({
          data: steps.map((s) => ({
            tenantId,
            ruleId,
            stepNumber: s.stepNumber,
            approverType: s.approverType as any,
            approverUserId: s.approverUserId,
            approverRoleKey: s.approverRoleKey,
            canDelegate: s.canDelegate,
            timeoutHours: s.timeoutHours,
            escalateToUserId: s.escalateToUserId,
            escalateToRoleKey: s.escalateToRoleKey,
          } as any)),
        });
      }

      const rule = await prisma.imdadApprovalWorkflowRule.update({
        where: { id: ruleId },
        data: {
          ...updates,
          version: { increment: 1 },
          updatedBy: userId,
        } as any,
        include: { steps: { orderBy: { stepNumber: 'asc' } as any } } as any,
      });

      await imdadAudit.log({
        tenantId,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'approval_rule',
        resourceId: ruleId,
        boundedContext: 'BC8_APPROVAL',
        previousData: existing as any,
        newData: rule as any,
        request: req,
      });

      return NextResponse.json({ data: rule });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.approval.workflows.update' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft delete rule
// ---------------------------------------------------------------------------

export const DELETE = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const { templateId, ruleId } = extractIds(req.nextUrl.pathname);

      const existing = await prisma.imdadApprovalWorkflowRule.findFirst({
        where: { id: ruleId, templateId, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
      }

      await prisma.imdadApprovalWorkflowRule.update({
        where: { id: ruleId },
        data: {
          isDeleted: true,
          version: { increment: 1 },
        },
      });

      await imdadAudit.log({
        tenantId,
        actorUserId: userId,
        actorRole: role,
        action: 'DELETE',
        resourceType: 'approval_rule',
        resourceId: ruleId,
        boundedContext: 'BC8_APPROVAL',
        previousData: existing as any,
        request: req,
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.approval.workflows.delete' }
);
