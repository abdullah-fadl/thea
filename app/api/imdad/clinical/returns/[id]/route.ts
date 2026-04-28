/**
 * SCM BC5 Clinical — Single Patient Return
 *
 * GET /api/imdad/clinical/returns/:id — Get patient return
 * PUT /api/imdad/clinical/returns/:id — Update patient return (optimistic locking)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single patient return
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const patientReturn = await prisma.imdadPatientReturn.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!patientReturn) {
        return NextResponse.json({ error: 'Patient return not found' }, { status: 404 });
      }

      return NextResponse.json({ data: patientReturn });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.returns.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update patient return with optimistic locking
// ---------------------------------------------------------------------------

const updateReturnSchema = z.object({
  version: z.number().int(),
  reason: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  itemCode: z.string().optional(),
  itemName: z.string().optional(),
  quantity: z.number().positive().optional(),
  unitOfMeasure: z.string().optional(),
  returnedBy: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  patientMrn: z.string().optional(),
  patientName: z.string().optional(),
  encounterId: z.string().uuid().optional(),
  dispenseRequestId: z.string().uuid().optional(),
  batchNumber: z.string().optional(),
  lotNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateReturnSchema.parse(body);

      const { version, ...updates } = parsed;

      const existing = await prisma.imdadPatientReturn.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Patient return not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — patient return was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const { encounterId: _enc, lotNumber: _lot, ...safeUpdates } = updates;
      const patientReturn = await prisma.imdadPatientReturn.update({
        where: { id },
        data: {
          ...safeUpdates,
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
        resourceType: 'PATIENT_RETURN',
        resourceId: id,
        boundedContext: 'BC5_CLINICAL',
        previousData: existing as any,
        newData: patientReturn as any,
        request: req,
      });

      return NextResponse.json({ data: patientReturn });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.returns.update' }
);
