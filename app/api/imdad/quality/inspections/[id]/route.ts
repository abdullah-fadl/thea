/**
 * SCM BC6 Quality — Single Quality Inspection
 *
 * GET   /api/imdad/quality/inspections/:id — Get inspection with checklist items
 * PUT   /api/imdad/quality/inspections/:id — Update inspection (optimistic locking)
 * PATCH /api/imdad/quality/inspections/:id — Status transition (SCHEDULED→IN_PROGRESS→PASSED/FAILED/CONDITIONAL_PASS)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single inspection with checklist items
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const inspection = await prisma.imdadQualityInspection.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: {
          checklistItems: true,
        } as any,
      });

      if (!inspection) {
        return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
      }

      return NextResponse.json({ data: inspection });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update inspection with optimistic locking
// ---------------------------------------------------------------------------

const updateInspectionSchema = z.object({
  version: z.number().int(),
  inspectionType: z.string().optional(),
  scheduledDate: z.string().optional(),
  inspectorId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  itemCode: z.string().optional(),
  itemName: z.string().optional(),
  batchLotId: z.string().uuid().optional(),
  batchNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateInspectionSchema.parse(body);

      const { version, scheduledDate, ...updates } = parsed;

      const existing = await prisma.imdadQualityInspection.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — inspection was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const inspection = await prisma.imdadQualityInspection.update({
        where: { id },
        data: {
          ...updates,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
          version: { increment: 1 },
          updatedBy: userId,
        } as any,
        include: { checklistItems: true } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'QUALITY_INSPECTION',
        resourceId: id,
        boundedContext: 'BC6_QUALITY',
        previousData: existing as any,
        newData: inspection as any,
        request: req,
      });

      return NextResponse.json({ data: inspection });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.update' }
);

// ---------------------------------------------------------------------------
// PATCH — Status transition
// Allowed flows: SCHEDULED → IN_PROGRESS → PASSED | FAILED | CONDITIONAL_PASS
// ---------------------------------------------------------------------------

const statusTransitionSchema = z.object({
  version: z.number().int(),
  status: z.enum(['IN_PROGRESS', 'PASSED', 'FAILED', 'CONDITIONAL_PASS']),
  overallResult: z.string().optional(),
  dispositionAction: z.string().optional(),
  completedDate: z.string().optional(),
  notes: z.string().optional(),
});

const VALID_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['IN_PROGRESS'],
  IN_PROGRESS: ['PASSED', 'FAILED', 'CONDITIONAL_PASS'],
};

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = statusTransitionSchema.parse(body);

      const existing = await prisma.imdadQualityInspection.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: { checklistItems: true } as any,
      });

      if (!existing) {
        return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict — inspection was modified by another user. Please refresh and try again.' },
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

      if (parsed.overallResult) updateData.overallResult = parsed.overallResult;
      if (parsed.dispositionAction) updateData.dispositionAction = parsed.dispositionAction;
      if (parsed.notes) updateData.notes = parsed.notes;

      if (parsed.status === 'IN_PROGRESS') {
        updateData.startedAt = new Date();
      }

      if (['PASSED', 'FAILED', 'CONDITIONAL_PASS'].includes(parsed.status)) {
        updateData.completedAt = parsed.completedDate ? new Date(parsed.completedDate) : new Date();
      }

      const inspection = await prisma.imdadQualityInspection.update({
        where: { id },
        data: updateData as any,
        include: { checklistItems: true } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'QUALITY_INSPECTION',
        resourceId: id,
        boundedContext: 'BC6_QUALITY',
        previousData: { status: existing.status },
        newData: { status: parsed.status, overallResult: parsed.overallResult, dispositionAction: parsed.dispositionAction },
        request: req,
      });

      return NextResponse.json({ data: inspection });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.approve' }
);
