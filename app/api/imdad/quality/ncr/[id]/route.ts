/**
 * SCM BC6 Quality — Single Non-Conformance Report
 *
 * GET   /api/imdad/quality/ncr/:id — Get NCR by id
 * PUT   /api/imdad/quality/ncr/:id — Update NCR (optimistic locking)
 * PATCH /api/imdad/quality/ncr/:id — Status transition (OPEN → INVESTIGATING → ROOT_CAUSE_IDENTIFIED → CORRECTIVE_ACTION → CLOSED)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// Valid NCR status transitions
const NCR_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['INVESTIGATING'],
  INVESTIGATING: ['ROOT_CAUSE_IDENTIFIED'],
  ROOT_CAUSE_IDENTIFIED: ['CORRECTIVE_ACTION'],
  CORRECTIVE_ACTION: ['CLOSED'],
};

// ---------------------------------------------------------------------------
// GET — Single NCR by id
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const ncr = await prisma.imdadNonConformanceReport.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!ncr) {
        return NextResponse.json({ error: 'Non-Conformance Report not found' }, { status: 404 });
      }

      return NextResponse.json({ data: ncr });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update NCR with optimistic locking
// ---------------------------------------------------------------------------

const updateNcrSchema = z.object({
  version: z.number().int({ message: 'version is required for optimistic locking' }),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  severity: z.string().optional(),
  itemId: z.string().optional(),
  vendorId: z.string().optional(),
  vendorName: z.string().optional(),
  lotNumber: z.string().optional(),
  quantityAffected: z.number().optional(),
  unitOfMeasure: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateNcrSchema.parse(body);

      const { version, ...updates } = parsed;

      const existing = await prisma.imdadNonConformanceReport.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Non-Conformance Report not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — NCR was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const ncr = await prisma.imdadNonConformanceReport.update({
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
        resourceType: 'NON_CONFORMANCE_REPORT',
        resourceId: id,
        boundedContext: 'BC6_QUALITY',
        previousData: existing as any,
        newData: ncr as any,
        request: req,
      });

      return NextResponse.json({ data: ncr });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.ncr.update' }
);

// ---------------------------------------------------------------------------
// PATCH — Status transition
// ---------------------------------------------------------------------------

const transitionNcrSchema = z.object({
  version: z.number().int({ message: 'version is required for optimistic locking' }),
  status: z.string().min(1, 'status is required'),
  rootCause: z.string().optional(),
  correctiveAction: z.string().optional(),
  preventiveAction: z.string().optional(),
  closedBy: z.string().optional(),
  closedAt: z.string().optional(),
  investigationNotes: z.string().optional(),
});

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = transitionNcrSchema.parse(body);

      const { version, status: newStatus, ...fields } = parsed;

      const existing = await prisma.imdadNonConformanceReport.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Non-Conformance Report not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — NCR was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      // Validate status transition
      const currentStatus = existing.status as string;
      const allowedTransitions = NCR_TRANSITIONS[currentStatus] || [];
      if (!allowedTransitions.includes(newStatus)) {
        return NextResponse.json(
          {
            error: `Invalid status transition from ${currentStatus} to ${newStatus}. Allowed: ${allowedTransitions.join(', ') || 'none'}`,
          },
          { status: 422 }
        );
      }

      const updateData: any = {
        status: newStatus,
        version: { increment: 1 },
        updatedBy: userId,
      };

      if (fields.rootCause !== undefined) updateData.rootCause = fields.rootCause;
      if (fields.correctiveAction !== undefined) updateData.correctiveAction = fields.correctiveAction;
      if (fields.preventiveAction !== undefined) updateData.preventiveAction = fields.preventiveAction;
      if (fields.investigationNotes !== undefined) updateData.investigationNotes = fields.investigationNotes;

      if (newStatus === 'CLOSED') {
        updateData.closedBy = fields.closedBy || userId;
        updateData.closedAt = fields.closedAt ? new Date(fields.closedAt) : new Date();
      }

      const ncr = await prisma.imdadNonConformanceReport.update({
        where: { id },
        data: updateData,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'NON_CONFORMANCE_REPORT',
        resourceId: id,
        boundedContext: 'BC6_QUALITY',
        previousData: existing as any,
        newData: ncr as any,
        request: req,
        metadata: { action: 'STATUS_TRANSITION', from: currentStatus, to: newStatus },
      });

      return NextResponse.json({ data: ncr });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.ncr.update' }
);
