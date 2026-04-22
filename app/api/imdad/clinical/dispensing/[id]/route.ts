/**
 * SCM BC5 Clinical — Single Dispense Request
 *
 * GET   /api/imdad/clinical/dispensing/:id — Get dispense request with lines
 * PUT   /api/imdad/clinical/dispensing/:id — Update dispense request (optimistic locking)
 * PATCH /api/imdad/clinical/dispensing/:id — Status transition (PENDING→PICKING→PICKED→VERIFIED→DISPENSED)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { stockMutate } from '@/lib/imdad/stockMutate';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single dispense request with lines
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const dispenseRequest = await prisma.imdadDispenseRequest.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: { lines: true } as any,
      });

      if (!dispenseRequest) {
        return NextResponse.json({ error: 'Dispense request not found' }, { status: 404 });
      }

      return NextResponse.json({ data: dispenseRequest });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.dispensing.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update dispense request with optimistic locking
// ---------------------------------------------------------------------------

const updateDispenseSchema = z.object({
  version: z.number().int(),
  orderType: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  patientMrn: z.string().optional(),
  patientName: z.string().optional(),
  encounterId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  priority: z.string().optional(),
  requestedBy: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateDispenseSchema.parse(body);

      const { version, ...updates } = parsed;

      const existing = await prisma.imdadDispenseRequest.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Dispense request not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — dispense request was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const dispenseRequest = await prisma.imdadDispenseRequest.update({
        where: { id },
        data: {
          ...updates,
          version: { increment: 1 },
          updatedBy: userId,
        },
        include: { lines: true } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'DISPENSE_REQUEST',
        resourceId: id,
        boundedContext: 'BC5_CLINICAL',
        previousData: existing as any,
        newData: dispenseRequest as any,
        request: req,
      });

      return NextResponse.json({ data: dispenseRequest });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.dispensing.update' }
);

// ---------------------------------------------------------------------------
// PATCH — Status transition
// Allowed flows: PENDING → PICKING → PICKED → VERIFIED → DISPENSED
// ---------------------------------------------------------------------------

const statusTransitionSchema = z.object({
  version: z.number().int(),
  status: z.enum(['PICKING', 'PICKED', 'VERIFIED', 'DISPENSED', 'CANCELLED']),
  verifiedBy: z.string().uuid().optional(),
  dispensedBy: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PICKING', 'CANCELLED'],
  PICKING: ['PICKED', 'CANCELLED'],
  PICKED: ['VERIFIED', 'CANCELLED'],
  VERIFIED: ['DISPENSED', 'CANCELLED'],
};

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = statusTransitionSchema.parse(body);

      const existing = await prisma.imdadDispenseRequest.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: { lines: true } as any,
      });

      if (!existing) {
        return NextResponse.json({ error: 'Dispense request not found' }, { status: 404 });
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict — dispense request was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const allowed = VALID_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(parsed.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${existing.status} to ${parsed.status}` },
          { status: 400 }
        );
      }

      const updateData: any = {
        status: parsed.status,
        version: { increment: 1 },
        updatedBy: userId,
      };

      if (parsed.notes) updateData.notes = parsed.notes;

      if (parsed.status === 'VERIFIED') {
        updateData.verifiedBy = parsed.verifiedBy || userId;
        updateData.verifiedAt = new Date();
      }
      if (parsed.status === 'DISPENSED') {
        updateData.dispensedBy = parsed.dispensedBy || userId;
        updateData.dispensedAt = new Date();
      }

      const dispenseRequest = await prisma.imdadDispenseRequest.update({
        where: { id },
        data: updateData,
        include: { lines: true } as any,
      });

      // When dispensing is complete, deduct stock for each line item
      if (parsed.status === 'DISPENSED' && (dispenseRequest as any).lines && (dispenseRequest as any).lines.length > 0) {
        const stockErrors: string[] = [];
        for (const line of (dispenseRequest as any).lines) {
          const qty = Number((line as any).quantity ?? (line as any).dispensedQuantity ?? 0);
          if (qty <= 0) continue;

          const lineItemId = (line as any).itemId;
          const lineLocationId = (line as any).locationId || (existing as any).locationId || (existing as any).departmentId;
          if (!lineItemId || !lineLocationId) continue;

          const result = await stockMutate({
            tenantId,
            organizationId: existing.organizationId!,
            itemId: lineItemId,
            locationId: lineLocationId,
            delta: -Math.round(qty),
            reason: `Dispensed — ${(existing as any).dispenseNumber || id}`,
            userId,
            referenceType: 'dispense_request',
            referenceId: id,
            batchNumber: (line as any).batchNumber || undefined,
            expiryDate: (line as any).expiryDate || undefined,
          });

          if (!result.success) {
            stockErrors.push(`Line ${(line as any).lineNumber || lineItemId}: ${result.error}`);
          }
        }

        if (stockErrors.length > 0) {
          console.error('[Clinical Dispensing] Stock deduction errors:', stockErrors);
        }
      }

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'DISPENSE_REQUEST',
        resourceId: id,
        boundedContext: 'BC5_CLINICAL',
        previousData: { status: existing.status },
        newData: { status: parsed.status },
        request: req,
      });

      return NextResponse.json({ data: dispenseRequest });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.dispensing.update' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft delete dispense request
// ---------------------------------------------------------------------------

export const DELETE = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const existing = await prisma.imdadDispenseRequest.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Dispense request not found' }, { status: 404 });
      }

      const dispenseRequest = await prisma.imdadDispenseRequest.update({
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
        resourceType: 'DISPENSE_REQUEST',
        resourceId: id,
        boundedContext: 'BC5_CLINICAL',
        previousData: existing as any,
        request: req,
      });

      return NextResponse.json({ data: dispenseRequest });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.dispensing.delete' }
);
