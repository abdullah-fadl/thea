/**
 * SCM BC6 Quality — Single Recall
 *
 * GET   /api/imdad/quality/recalls/:id — Get recall with actions
 * PUT   /api/imdad/quality/recalls/:id — Update recall (optimistic locking)
 * PATCH /api/imdad/quality/recalls/:id — Status transition + update quantities
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single recall with actions
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const recall = await prisma.imdadRecall.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: {
          actions: true,
        } as any,
      });

      if (!recall) {
        return NextResponse.json({ error: 'Recall not found' }, { status: 404 });
      }

      return NextResponse.json({ data: recall });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update recall with optimistic locking
// ---------------------------------------------------------------------------

const updateRecallSchema = z.object({
  version: z.number().int(),
  severity: z.string().optional(),
  recallReason: z.string().optional(),
  batchNumbers: z.array(z.string()).optional(),
  quantityAffected: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateRecallSchema.parse(body);

      const { version, ...updates } = parsed;

      const existing = await prisma.imdadRecall.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Recall not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — recall was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const recall = await prisma.imdadRecall.update({
        where: { id },
        data: {
          ...updates,
          version: { increment: 1 },
          updatedBy: userId,
        } as any,
        include: { actions: true } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'RECALL',
        resourceId: id,
        boundedContext: 'BC6_QUALITY',
        previousData: existing as any,
        newData: recall as any,
        request: req,
      });

      return NextResponse.json({ data: recall });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.recall.update' }
);

// ---------------------------------------------------------------------------
// PATCH — Status transition + update quantities recovered/destroyed
// ---------------------------------------------------------------------------

const patchRecallSchema = z.object({
  version: z.number().int(),
  status: z.string().min(1),
  quantityRecovered: z.number().nonnegative().optional(),
  quantityDestroyed: z.number().nonnegative().optional(),
  completedAt: z.string().optional(),
  notes: z.string().optional(),
});

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = patchRecallSchema.parse(body);

      const existing = await prisma.imdadRecall.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: { actions: true } as any,
      });

      if (!existing) {
        return NextResponse.json({ error: 'Recall not found' }, { status: 404 });
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict — recall was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const updateData: any = {
        status: parsed.status,
        version: { increment: 1 },
        updatedBy: userId,
      };

      if (parsed.quantityRecovered !== undefined) updateData.quantityRecovered = parsed.quantityRecovered;
      if (parsed.quantityDestroyed !== undefined) updateData.quantityDestroyed = parsed.quantityDestroyed;
      if (parsed.notes) updateData.notes = parsed.notes;
      if (parsed.completedAt) updateData.completedAt = new Date(parsed.completedAt);
      if (parsed.status === 'CLOSED' && !parsed.completedAt) {
        updateData.completedAt = new Date();
      }

      const recall = await prisma.imdadRecall.update({
        where: { id },
        data: updateData as any,
        include: { actions: true } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'RECALL',
        resourceId: id,
        boundedContext: 'BC6_QUALITY',
        previousData: { status: existing.status },
        newData: {
          status: parsed.status,
          quantityRecovered: parsed.quantityRecovered,
          quantityDestroyed: parsed.quantityDestroyed,
        },
        request: req,
      });

      return NextResponse.json({ data: recall });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.recall.update' }
);
