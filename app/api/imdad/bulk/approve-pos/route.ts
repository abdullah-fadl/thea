/**
 * SCM Bulk — Batch Approve Purchase Orders
 *
 * POST /api/imdad/bulk/approve-pos
 * Body: { poIds: string[], notes?: string }
 * Returns: { approved: number, failed: { id: string, reason: string }[] }
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

export const dynamic = 'force-dynamic';

const bulkApproveSchema = z.object({
  poIds: z
    .array(z.string().uuid())
    .min(1, 'At least one PO ID is required')
    .max(100, 'Maximum 100 POs per batch'),
  notes: z.string().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = bulkApproveSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const { poIds, notes } = parsed.data;
      const now = new Date();
      let approved = 0;
      const failed: { id: string; reason: string }[] = [];

      // Fetch all POs in one query
      const purchaseOrders = await prisma.imdadPurchaseOrder.findMany({
        where: {
          tenantId,
          id: { in: poIds },
          isDeleted: false,
        },
        select: {
          id: true,
          poNumber: true,
          status: true,
          organizationId: true,
        },
      });

      const poMap = new Map((purchaseOrders as any[]).map((po) => [po.id, po]));

      // Process each PO individually for partial success
      for (const poId of poIds) {
        const po = poMap.get(poId);

        if (!po) {
          failed.push({ id: poId, reason: 'Purchase order not found' });
          continue;
        }

        if (po.status !== 'PENDING_APPROVAL') {
          failed.push({
            id: poId,
            reason: `PO ${po.poNumber} is in ${po.status} status, expected PENDING_APPROVAL`,
          });
          continue;
        }

        try {
          // Conditional update: only succeeds if PO is still PENDING_APPROVAL (optimistic locking)
          const result = await prisma.imdadPurchaseOrder.updateMany({
            where: { id: poId, status: 'PENDING_APPROVAL', tenantId, isDeleted: false },
            data: {
              status: 'APPROVED',
              updatedBy: userId,
              notes: notes ? notes : undefined,
            },
          });

          if (result.count === 0) {
            failed.push({ id: poId, reason: `PO ${po.poNumber} was modified concurrently — status is no longer PENDING_APPROVAL` });
            continue;
          }

          await imdadAudit.log({
            tenantId,
            organizationId: po.organizationId,
            actorUserId: userId,
            actorRole: role,
            action: 'APPROVE',
            resourceType: 'purchase_order',
            resourceId: po.id,
            boundedContext: 'BC3_PROCUREMENT',
            newData: {
              status: 'APPROVED',
              approvedBy: userId,
              approvedAt: now.toISOString(),
              notes,
            },
            request: req,
          });

          approved++;
        } catch {
          failed.push({ id: poId, reason: `Failed to update PO ${po.poNumber}` });
        }
      }

      return NextResponse.json({ approved, failed });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.purchase-orders.approve' }
);
