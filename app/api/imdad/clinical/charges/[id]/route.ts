/**
 * SCM BC5 Clinical — Single Patient Charge
 *
 * GET   /api/imdad/clinical/charges/:id — Get patient charge
 * PATCH /api/imdad/clinical/charges/:id — Status changes (PENDING→CHARGED→BILLED) and reversals (→REVERSED/VOIDED)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single patient charge
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const patientCharge = await prisma.imdadPatientCharge.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!patientCharge) {
        return NextResponse.json({ error: 'Patient charge not found' }, { status: 404 });
      }

      return NextResponse.json({ data: patientCharge });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.charges.view' }
);

// ---------------------------------------------------------------------------
// PATCH — Status transition
// Allowed flows: PENDING → CHARGED → BILLED
// Reversals: any non-terminal → REVERSED | VOIDED
// ---------------------------------------------------------------------------

const statusTransitionSchema = z.object({
  version: z.number().int(),
  status: z.enum(['CHARGED', 'BILLED', 'REVERSED', 'VOIDED']),
  reversalReason: z.string().optional(),
  notes: z.string().optional(),
});

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CHARGED', 'REVERSED', 'VOIDED'],
  CHARGED: ['BILLED', 'REVERSED', 'VOIDED'],
  BILLED: ['REVERSED', 'VOIDED'],
};

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = statusTransitionSchema.parse(body);

      const existing = await prisma.imdadPatientCharge.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Patient charge not found' }, { status: 404 });
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict — patient charge was modified by another user. Please refresh and try again.' },
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

      if (['REVERSED', 'VOIDED'].includes(parsed.status)) {
        updateData.reversalReason = parsed.reversalReason;
        updateData.reversedBy = userId;
        updateData.reversedAt = new Date();
      }

      const patientCharge = await prisma.imdadPatientCharge.update({
        where: { id },
        data: updateData,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'PATIENT_CHARGE',
        resourceId: id,
        boundedContext: 'BC5_CLINICAL',
        previousData: { status: existing.status },
        newData: { status: parsed.status, reversalReason: parsed.reversalReason },
        request: req,
      });

      return NextResponse.json({ data: patientCharge });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.charges.update' }
);
