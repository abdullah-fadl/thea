import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/care-gaps/[id]
 *
 * Fetch a single care gap with its outreach history.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const id = req.nextUrl.pathname.split('/').pop();

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const gap = await prisma.careGap.findFirst({
      where: { id, tenantId },
      include: {
        outreachLogs: {
          orderBy: { sentAt: 'desc' },
        },
      },
    });

    if (!gap) {
      return NextResponse.json({ error: 'Care gap not found' }, { status: 404 });
    }

    return NextResponse.json({ gap });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKeys: ['opd.visit.view', 'opd.doctor.encounter.view'],
  }
);

/**
 * PATCH /api/care-gaps/[id]
 *
 * Update care gap status (resolve, dismiss, update priority, etc.)
 */
export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const id = req.nextUrl.pathname.split('/').pop();
    const body = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const existing = await prisma.careGap.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Care gap not found' }, { status: 404 });
    }

    const updateData: any = {};
    const now = new Date();

    // Status transitions
    if (body.status) {
      const validTransitions: Record<string, string[]> = {
        OPEN: ['CONTACTED', 'SCHEDULED', 'RESOLVED', 'DISMISSED'],
        CONTACTED: ['SCHEDULED', 'RESOLVED', 'DISMISSED', 'OPEN'],
        SCHEDULED: ['RESOLVED', 'DISMISSED', 'OPEN'],
        RESOLVED: [], // Terminal state
        DISMISSED: ['OPEN'], // Can be re-opened
      };

      const allowed = validTransitions[existing.status] || [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          {
            error: 'INVALID_TRANSITION',
            message: `Cannot transition from ${existing.status} to ${body.status}`,
            allowedTransitions: allowed,
          },
          { status: 400 }
        );
      }

      updateData.status = body.status;

      if (body.status === 'RESOLVED') {
        updateData.resolvedAt = now;
        updateData.resolvedBy = userId;
        updateData.resolvedReason = body.resolvedReason || null;
      }

      if (body.status === 'DISMISSED') {
        updateData.dismissedAt = now;
        updateData.dismissedBy = userId;
        updateData.dismissedReason = body.dismissedReason || null;
      }

      // If re-opening, clear resolved/dismissed timestamps
      if (body.status === 'OPEN') {
        updateData.resolvedAt = null;
        updateData.resolvedBy = null;
        updateData.resolvedReason = null;
        updateData.dismissedAt = null;
        updateData.dismissedBy = null;
        updateData.dismissedReason = null;
      }
    }

    // Optional field updates
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.severityScore !== undefined) updateData.severityScore = body.severityScore;
    if (body.reason !== undefined) updateData.reason = body.reason;
    if (body.reasonAr !== undefined) updateData.reasonAr = body.reasonAr;
    if (body.dueAt !== undefined) updateData.dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (body.meta !== undefined) updateData.meta = body.meta;

    const updated = await prisma.careGap.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ ok: true, gap: updated });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKeys: ['opd.visit.edit', 'opd.doctor.encounter.view'],
  }
);
