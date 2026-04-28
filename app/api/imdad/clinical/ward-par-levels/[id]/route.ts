/**
 * SCM BC5 Clinical — Single Ward PAR Level
 *
 * GET    /api/imdad/clinical/ward-par-levels/:id — Get ward PAR level
 * PUT    /api/imdad/clinical/ward-par-levels/:id — Update ward PAR level (optimistic locking)
 * DELETE /api/imdad/clinical/ward-par-levels/:id — Soft delete ward PAR level
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single ward PAR level
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const wardParLevel = await prisma.imdadWardParLevel.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!wardParLevel) {
        return NextResponse.json({ error: 'Ward PAR level not found' }, { status: 404 });
      }

      return NextResponse.json({ data: wardParLevel });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.ward.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update ward PAR level with optimistic locking
// ---------------------------------------------------------------------------

const updateParLevelSchema = z.object({
  version: z.number().int(),
  locationId: z.string().uuid().optional(),
  itemCode: z.string().min(1).max(50).optional(),
  itemName: z.string().min(1).optional(),
  parLevel: z.number().int().nonnegative().optional(),
  maxLevel: z.number().int().nonnegative().optional(),
  reorderQty: z.number().int().nonnegative().optional(),
  unitOfMeasure: z.string().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateParLevelSchema.parse(body);

      const { version, ...updates } = parsed;

      const existing = await prisma.imdadWardParLevel.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Ward PAR level not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — ward PAR level was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const wardParLevel = await prisma.imdadWardParLevel.update({
        where: { id },
        data: {
          ...updates,
          version: { increment: 1 },
          updatedBy: userId,
        },
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'WARD_PAR_LEVEL',
        resourceId: id,
        boundedContext: 'BC5_CLINICAL',
        previousData: existing as any,
        newData: wardParLevel as any,
        request: req,
      });

      return NextResponse.json({ data: wardParLevel });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.ward.update' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft delete ward PAR level
// ---------------------------------------------------------------------------

export const DELETE = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const existing = await prisma.imdadWardParLevel.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Ward PAR level not found' }, { status: 404 });
      }

      const wardParLevel = await prisma.imdadWardParLevel.update({
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
        resourceType: 'WARD_PAR_LEVEL',
        resourceId: id,
        boundedContext: 'BC5_CLINICAL',
        previousData: existing as any,
        request: req,
      });

      return NextResponse.json({ data: wardParLevel });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.ward.update' }
);
