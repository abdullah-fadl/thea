/**
 * SCM Approval — Single Workflow Template
 *
 * GET    /api/imdad/approval/workflows/:id — Get workflow with rules
 * PUT    /api/imdad/approval/workflows/:id — Update workflow (optimistic locking)
 * DELETE /api/imdad/approval/workflows/:id — Soft delete workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single workflow with rules
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const workflow = await prisma.imdadApprovalWorkflowTemplate.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: {
          rules: {
            where: { isDeleted: false },
            orderBy: { ruleOrder: 'asc' },
            include: { steps: { orderBy: { stepNumber: 'asc' } } },
          },
        } as any,
      });

      if (!workflow) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }

      return NextResponse.json({ data: workflow });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.approval.workflows.list' }
);

// ---------------------------------------------------------------------------
// PUT — Update workflow with optimistic locking
// ---------------------------------------------------------------------------

const updateWorkflowSchema = z.object({
  version: z.number().int(),
  name: z.string().min(1).max(255).optional(),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  documentType: z.string().optional(),
  isActive: z.boolean().optional(),
  autoApproveBelow: z.number().min(0).optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateWorkflowSchema.parse(body);

      const { version, ...updates } = parsed;

      const existing = await prisma.imdadApprovalWorkflowTemplate.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — workflow was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const workflow = await prisma.imdadApprovalWorkflowTemplate.update({
        where: { id },
        data: {
          ...updates,
          version: { increment: 1 },
          updatedBy: userId,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'approval_workflow',
        resourceId: id,
        boundedContext: 'BC8_APPROVAL',
        previousData: existing as any,
        newData: workflow as any,
        request: req,
      });

      return NextResponse.json({ data: workflow });
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
// DELETE — Soft delete workflow
// ---------------------------------------------------------------------------

export const DELETE = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const existing = await prisma.imdadApprovalWorkflowTemplate.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }

      await prisma.imdadApprovalWorkflowTemplate.update({
        where: { id },
        data: {
          isDeleted: true,
          version: { increment: 1 },
          updatedBy: userId,
        },
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'DELETE',
        resourceType: 'approval_workflow',
        resourceId: id,
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
