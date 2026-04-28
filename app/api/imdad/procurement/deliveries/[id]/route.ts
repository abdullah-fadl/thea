/**
 * SCM BC3 Procurement — Single Delivery
 *
 * GET   /api/imdad/procurement/deliveries/:id — Get delivery details
 * PATCH /api/imdad/procurement/deliveries/:id — Status transitions & tracking updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single delivery with tracking history
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const delivery = await (prisma as any).imdadDelivery.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!delivery) {
        return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
      }

      return NextResponse.json({ data: delivery });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.view' }
);

// ---------------------------------------------------------------------------
// PATCH — Status transitions & tracking updates
// CREATED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED → RECEIVED
// Also allows: DELAYED, RETURNED, CANCELLED from most states
// ---------------------------------------------------------------------------

const patchSchema = z.object({
  version: z.number().int(),
  action: z.enum([
    'ship',        // CREATED → IN_TRANSIT
    'delay',       // IN_TRANSIT → DELAYED
    'resume',      // DELAYED → IN_TRANSIT
    'out_for_delivery', // IN_TRANSIT → OUT_FOR_DELIVERY
    'deliver',     // OUT_FOR_DELIVERY → DELIVERED
    'receive',     // DELIVERED → RECEIVED
    'return',      // any → RETURNED
    'cancel',      // any → CANCELLED
  ]),
  trackingNumber: z.string().optional(),
  actualDepartureDate: z.string().optional(),
  actualArrivalDate: z.string().optional(),
  delayReason: z.string().optional(),
  notes: z.string().optional(),
});

const VALID_TRANSITIONS: Record<string, Record<string, string>> = {
  ship: { CREATED: 'IN_TRANSIT' },
  delay: { IN_TRANSIT: 'DELAYED', OUT_FOR_DELIVERY: 'DELAYED' },
  resume: { DELAYED: 'IN_TRANSIT' },
  out_for_delivery: { IN_TRANSIT: 'OUT_FOR_DELIVERY' },
  deliver: { OUT_FOR_DELIVERY: 'DELIVERED', IN_TRANSIT: 'DELIVERED' },
  receive: { DELIVERED: 'RECEIVED' },
  return: { CREATED: 'RETURNED', IN_TRANSIT: 'RETURNED', DELAYED: 'RETURNED', OUT_FOR_DELIVERY: 'RETURNED', DELIVERED: 'RETURNED' },
  cancel: { CREATED: 'CANCELLED', IN_TRANSIT: 'CANCELLED', DELAYED: 'CANCELLED' },
};

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = patchSchema.parse(body);

      const existing = await (prisma as any).imdadDelivery.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict — record was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const transitionMap = VALID_TRANSITIONS[parsed.action];
      const newStatus = transitionMap?.[existing.status as string];
      if (!newStatus) {
        return NextResponse.json(
          { error: `Cannot ${parsed.action} — current status is ${existing.status}` },
          { status: 400 }
        );
      }

      const updateData: any = {
        status: newStatus,
        version: { increment: 1 },
        updatedBy: userId,
      };

      if (parsed.trackingNumber) updateData.trackingNumber = parsed.trackingNumber;
      if (parsed.notes) updateData.notes = parsed.notes;
      if (parsed.actualDepartureDate) updateData.actualDepartureDate = new Date(parsed.actualDepartureDate);
      if (parsed.actualArrivalDate) updateData.actualArrivalDate = new Date(parsed.actualArrivalDate);
      if (parsed.delayReason) updateData.delayReason = parsed.delayReason;

      if (parsed.action === 'ship') {
        updateData.actualDepartureDate = updateData.actualDepartureDate || new Date();
      }
      if (parsed.action === 'deliver' || parsed.action === 'receive') {
        updateData.actualArrivalDate = updateData.actualArrivalDate || new Date();
      }
      if (parsed.action === 'receive') {
        updateData.receivedAt = new Date();
        updateData.receivedBy = userId;
      }

      const delivery = await (prisma as any).imdadDelivery.update({
        where: { id },
        data: updateData,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: parsed.action.toUpperCase(),
        resourceType: 'DELIVERY',
        resourceId: id,
        boundedContext: 'BC3_PROCUREMENT',
        previousData: { status: existing.status },
        newData: { status: newStatus },
        request: req,
      });

      return NextResponse.json({ data: delivery });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.delivery.update' }
);
