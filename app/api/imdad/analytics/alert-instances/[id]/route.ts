/**
 * SCM BC8 Analytics — Single Alert Instance
 *
 * GET   /api/imdad/analytics/alert-instances/:id — Get alert instance
 * PATCH /api/imdad/analytics/alert-instances/:id — Status transition (ACTIVE→ACKNOWLEDGED→RESOLVED, any→DISMISSED)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single alert instance
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const alertInstance = await prisma.imdadAlertInstance.findFirst({
        where: { id, tenantId },
      });

      if (!alertInstance) {
        return NextResponse.json({ error: 'Alert instance not found' }, { status: 404 });
      }

      return NextResponse.json({ data: alertInstance });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.alert-instances.view' }
);

// ---------------------------------------------------------------------------
// PATCH — Status transition with version check
// Allowed flows:
//   ACTIVE       → ACKNOWLEDGED (set acknowledgedBy, acknowledgedAt)
//   ACKNOWLEDGED → RESOLVED     (set resolvedBy, resolvedAt)
//   any          → DISMISSED    (set acknowledgedBy if not set)
// ---------------------------------------------------------------------------

const statusTransitionSchema = z.object({
  version: z.number().int(),
  status: z.enum(['ACKNOWLEDGED', 'RESOLVED', 'DISMISSED']),
  notes: z.string().optional(),
});

const VALID_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ['ACKNOWLEDGED', 'DISMISSED'],
  ACKNOWLEDGED: ['RESOLVED', 'DISMISSED'],
};

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = statusTransitionSchema.parse(body);

      const existing = await prisma.imdadAlertInstance.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Alert instance not found' }, { status: 404 });
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict — alert instance was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      // Validate transition (DISMISSED is allowed from any non-terminal state)
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

      if (parsed.status === 'ACKNOWLEDGED') {
        updateData.acknowledgedBy = userId;
        updateData.acknowledgedAt = new Date();
      }

      if (parsed.status === 'RESOLVED') {
        updateData.resolvedBy = userId;
        updateData.resolvedAt = new Date();
      }

      if (parsed.status === 'DISMISSED') {
        if (!existing.acknowledgedBy) {
          updateData.acknowledgedBy = userId;
          updateData.acknowledgedAt = new Date();
        }
      }

      const alertInstance = await prisma.imdadAlertInstance.update({
        where: { id },
        data: updateData,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'ALERT_INSTANCE',
        resourceId: id,
        boundedContext: 'BC8_ANALYTICS',
        previousData: { status: existing.status },
        newData: { status: parsed.status },
        request: req,
      });

      return NextResponse.json({ data: alertInstance });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.analytics.alert-instances.update' }
);
