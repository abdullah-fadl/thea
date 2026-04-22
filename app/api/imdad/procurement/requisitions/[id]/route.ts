/**
 * SCM BC3 Procurement — Single Purchase Requisition
 *
 * GET   /api/imdad/procurement/requisitions/:id — Get PR with lines
 * PUT   /api/imdad/procurement/requisitions/:id — Update PR (DRAFT only)
 * PATCH /api/imdad/procurement/requisitions/:id — Status transitions (submit/approve/reject)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single PR with lines
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const pr = await prisma.imdadPurchaseRequisition.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: { lines: true } as any,
      });

      if (!pr) {
        return NextResponse.json({ error: 'Purchase requisition not found' }, { status: 404 });
      }

      return NextResponse.json({ data: pr });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update PR (only when DRAFT)
// ---------------------------------------------------------------------------

const prLineSchema = z.object({
  id: z.string().uuid().optional(),
  itemId: z.string().uuid(),
  itemCode: z.string().optional(),
  itemName: z.string().min(1),
  quantity: z.number().positive(),
  unitOfMeasure: z.string().min(1),
  estimatedUnitPrice: z.number().nonnegative().optional(),
  specifications: z.string().optional(),
  notes: z.string().optional(),
});

const updatePrSchema = z.object({
  version: z.number().int(),
  departmentId: z.string().uuid().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  requiredDate: z.string().optional(),
  justification: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(prLineSchema).min(1).optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updatePrSchema.parse(body);

      const existing = await prisma.imdadPurchaseRequisition.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: { lines: true } as any,
      });

      if (!existing) {
        return NextResponse.json({ error: 'Purchase requisition not found' }, { status: 404 });
      }

      if (existing.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'Only DRAFT requisitions can be updated' },
          { status: 400 }
        );
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict — requisition was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const { version, lines, ...updates } = parsed;

      // Use a transaction for updating PR + lines
      const pr = await prisma.$transaction(async (tx) => {
        // If lines provided, replace all lines
        if (lines) {
          await tx.imdadPurchaseRequisitionLine.deleteMany({
            where: { prId: id },
          });

          await tx.imdadPurchaseRequisitionLine.createMany({
            data: lines.map((line, idx) => ({
              tenantId,
              organizationId: existing.organizationId,
              prId: id,
              lineNumber: idx + 1,
              itemId: line.itemId,
              quantity: line.quantity,
              estimatedUnitCost: line.estimatedUnitPrice,
              estimatedTotal: line.estimatedUnitPrice
                ? line.quantity * line.estimatedUnitPrice
                : undefined,
              notes: line.notes,
            })) as any,
          });
        }

        return tx.imdadPurchaseRequisition.update({
          where: { id },
          data: {
            ...updates,
            version: { increment: 1 },
            updatedBy: userId,
          },
          include: { lines: true } as any,
        });
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'purchase_requisition',
        resourceId: id,
        boundedContext: 'BC3_PROCUREMENT',
        previousData: existing as any,
        newData: pr as any,
        request: req,
      });

      return NextResponse.json({ data: pr });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.pr.edit' }
);

// ---------------------------------------------------------------------------
// PATCH — Status transitions (submit / approve / reject)
// ---------------------------------------------------------------------------

const patchSchema = z.object({
  action: z.enum(['submit', 'approve', 'reject']),
  version: z.number().int(),
  rejectionReason: z.string().optional(),
});

const VALID_TRANSITIONS: Record<string, Record<string, string>> = {
  submit: { from: 'DRAFT', to: 'PENDING_APPROVAL' },
  approve: { from: 'PENDING_APPROVAL', to: 'APPROVED' },
  reject: { from: 'PENDING_APPROVAL', to: 'REJECTED' },
};

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = patchSchema.parse(body);

      const existing = await prisma.imdadPurchaseRequisition.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: { lines: true } as any,
      });

      if (!existing) {
        return NextResponse.json({ error: 'Purchase requisition not found' }, { status: 404 });
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict', message: 'Record was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const transition = VALID_TRANSITIONS[parsed.action];
      if (existing.status !== transition.from) {
        return NextResponse.json(
          { error: `Cannot ${parsed.action} — current status is ${existing.status}, expected ${transition.from}` },
          { status: 400 }
        );
      }

      if (parsed.action === 'reject' && !parsed.rejectionReason) {
        return NextResponse.json(
          { error: 'rejectionReason is required when rejecting a requisition' },
          { status: 400 }
        );
      }

      const updateData: any = {
        status: transition.to,
        version: { increment: 1 },
        updatedBy: userId,
      };

      // Note: submittedAt/approvedAt/rejectedAt fields are not in the Prisma model.
      // Status change + updatedBy is sufficient for tracking.

      const pr = await prisma.imdadPurchaseRequisition.update({
        where: { id },
        data: updateData as any,
        include: { lines: true } as any,
      });

      const auditAction = parsed.action === 'submit'
        ? 'SUBMIT' as const
        : parsed.action === 'approve'
          ? 'APPROVE' as const
          : 'REJECT' as const;

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: auditAction,
        resourceType: 'purchase_requisition',
        resourceId: id,
        boundedContext: 'BC3_PROCUREMENT',
        previousData: { status: existing.status },
        newData: { status: pr.status, action: parsed.action },
        request: req,
      });

      return NextResponse.json({ data: pr });
    } catch (error) {
      console.error('[PR PATCH] Error:', error);
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.pr.approve' }
);
