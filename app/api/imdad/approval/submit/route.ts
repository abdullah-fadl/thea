/**
 * SCM Approval — Submit for Approval
 *
 * POST /api/imdad/approval/submit — Submit a document for approval
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const Decimal = Prisma.Decimal;

const submitSchema = z.object({
  documentType: z.string().min(1),
  entityId: z.string().uuid(),
  entityType: z.string().min(1),
  amount: z.number().min(0),
  currency: z.string().default('SAR'),
  organizationId: z.string().uuid(),
  notes: z.string().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = submitSchema.parse(body);

      // 1. Find matching workflow template (most recent first to pick latest rules)
      let workflow: any = null;
      try {
        workflow = await prisma.imdadApprovalWorkflowTemplate.findFirst({
          where: {
            tenantId,
            organizationId: parsed.organizationId,
            documentType: parsed.documentType as any,
            isActive: true,
            isDeleted: false,
          },
          orderBy: { createdAt: 'desc' },
          include: {
            rules: {
              where: { isDeleted: false },
              orderBy: { ruleOrder: 'asc' },
              include: { steps: { orderBy: { stepNumber: 'asc' } } },
            },
          } as any,
        });
      } catch {
        // Invalid documentType enum value — no matching workflow
      }

      if (!workflow) {
        return NextResponse.json(
          { error: 'No active approval workflow found for this document type' },
          { status: 404 }
        );
      }

      // 2. Check auto-approve (first matching rule with autoApprove=true and no steps)
      const autoRule = (workflow.rules as any[]).find((r: any) => r.autoApprove);
      if (autoRule && autoRule.steps.length === 0) {
        const request = await prisma.imdadApprovalRequest.create({
          data: {
            tenantId,
            organizationId: parsed.organizationId,
            entityId: parsed.entityId,
            entityType: parsed.entityType,
            status: 'APPROVED' as any,
            submittedBy: userId,
            totalSteps: 0,
            currentStep: 0,
            completedAt: new Date(),
          } as any,
        });

        await imdadAudit.log({
          tenantId,
          organizationId: parsed.organizationId,
          actorUserId: userId,
          actorRole: role,
          action: 'CREATE',
          resourceType: 'approval_request',
          resourceId: request.id,
          boundedContext: 'BC8_APPROVAL',
          metadata: { autoApproved: true, amount: parsed.amount },
          request: req,
        });

        return NextResponse.json({
          data: {
            requestId: request.id,
            status: 'APPROVED',
            totalSteps: 0,
            currentStep: 0,
            autoApproved: true,
          },
        }, { status: 201 });
      }

      // 3. Find matching rule by amount range
      console.log(`[Approval] Workflow ${workflow.id} has ${(workflow.rules as any[]).length} rules for amount=${parsed.amount}`);
      for (const r of workflow.rules as any[]) {
        console.log(`[Approval]   Rule ${r.id}: minAmount=${r.minAmount} maxAmount=${r.maxAmount} steps=${r.steps?.length}`);
      }
      const matchingRule = (workflow.rules as any[]).find((r: any) => {
        const min = r.minAmount != null ? parseFloat(String(r.minAmount)) : null;
        const max = r.maxAmount != null ? parseFloat(String(r.maxAmount)) : null;
        const minOk = min == null || parsed.amount >= min;
        const maxOk = max == null || parsed.amount <= max;
        console.log(`[Approval]   Checking rule: min=${min} max=${max} minOk=${minOk} maxOk=${maxOk}`);
        return minOk && maxOk;
      });

      if (!matchingRule || matchingRule.steps.length === 0) {
        return NextResponse.json(
          { error: 'No matching approval rule found for this amount' },
          { status: 422 }
        );
      }

      // 4. Create approval request + steps in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const request = await tx.imdadApprovalRequest.create({
          data: {
            tenantId,
            organizationId: parsed.organizationId,
            entityId: parsed.entityId,
            entityType: parsed.entityType,
            status: 'PENDING' as any,
            submittedBy: userId,
            totalSteps: matchingRule.steps.length,
            currentStep: 1,
          } as any,
        });

        // Create step records
        for (const stepDef of matchingRule.steps) {
          await tx.imdadApprovalStep.create({
            data: {
              tenantId,
              organizationId: parsed.organizationId,
              requestId: request.id,
              stepNumber: stepDef.stepNumber,
              approverId: stepDef.approverUserId || userId,
              approverRole: stepDef.approverRoleKey,
              canDelegate: stepDef.canDelegate,
              timeoutHours: stepDef.timeoutHours,
              status: 'PENDING' as any,
            } as any,
          });
        }

        return request;
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'approval_request',
        resourceId: result.id,
        boundedContext: 'BC8_APPROVAL',
        metadata: { amount: parsed.amount, totalSteps: matchingRule.steps.length },
        request: req,
      });

      return NextResponse.json({
        data: {
          requestId: result.id,
          status: 'PENDING',
          totalSteps: matchingRule.steps.length,
          currentStep: 1,
        },
      }, { status: 201 });
    } catch (error) {
      console.error('[Approval Submit] Error:', error);
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.approval.submit' }
);
