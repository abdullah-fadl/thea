import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { resolvePxTenantUuid } from '@/lib/patient-experience/tenant';
import {
  PX_CATEGORIES,
  PX_SEVERITIES,
  PX_STATUSES,
  type PxStatus,
} from '@/lib/patient-experience/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const updateSchema = z.object({
  status: z.enum(PX_STATUSES).optional(),
  severity: z.enum(PX_SEVERITIES).optional(),
  categoryKey: z.enum(PX_CATEGORIES).optional(),
  assignedDeptKey: z.string().trim().max(80).nullable().optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  satisfactionScore: z.number().int().min(1).max(5).nullable().optional(),
  resolutionNotes: z.string().trim().max(8000).nullable().optional(),
  detailsEn: z.string().trim().max(8000).nullable().optional(),
  detailsAr: z.string().trim().max(8000).nullable().optional(),
  contactPhone: z.string().trim().max(40).nullable().optional(),
  contactEmail: z.string().trim().email().max(160).nullable().optional().or(z.literal('').transform(() => null)),
});

const RESOLVED_STATES = new Set<PxStatus>(['RESOLVED', 'CLOSED']);

/**
 * GET /api/patient-experience/cases/[id]
 *
 * Returns the case + ordered timeline (PxComment).
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const id = String((await params)?.id ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid case id' }, { status: 400 });
    }
    const resolved = await resolvePxTenantUuid(tenantId);
    if (resolved instanceof NextResponse) return resolved;
    const { tenantUuid } = resolved;

    const [pxCase, comments] = await Promise.all([
      prisma.pxCase.findFirst({ where: { id, tenantId: tenantUuid } }),
      prisma.pxComment.findMany({
        where: { caseId: id, tenantId: tenantUuid },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!pxCase) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, case: pxCase, timeline: comments });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'px.cases.view' },
);

/**
 * PATCH /api/patient-experience/cases/[id]
 *
 * Updates status / severity / assignee / notes. Status transitions auto-add a
 * STATUS_CHANGE timeline entry; resolving stamps resolvedAt + resolutionMinutes.
 */
export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
    const id = String((await params)?.id ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid case id' }, { status: 400 });
    }
    const resolved = await resolvePxTenantUuid(tenantId);
    if (resolved instanceof NextResponse) return resolved;
    const { tenantUuid } = resolved;

    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const existing = await prisma.pxCase.findFirst({ where: { id, tenantId: tenantUuid } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const patch = parsed.data;
    const updateData: Record<string, unknown> = { ...patch };
    let statusChange: { from: string; to: string } | null = null;
    let assigneeChange: { from: string | null; to: string | null } | null = null;

    if (patch.status && patch.status !== existing.status) {
      statusChange = { from: existing.status, to: patch.status };
      if (RESOLVED_STATES.has(patch.status as PxStatus) && !existing.resolvedAt) {
        const now = new Date();
        updateData.resolvedAt = now;
        updateData.resolutionMinutes = Math.max(
          0,
          Math.round((now.getTime() - new Date(existing.createdAt).getTime()) / 60000),
        );
      }
    }

    if (
      patch.assigneeUserId !== undefined &&
      patch.assigneeUserId !== existing.assigneeUserId
    ) {
      assigneeChange = {
        from: existing.assigneeUserId ?? null,
        to: patch.assigneeUserId ?? null,
      };
    }

    const updated = await prisma.pxCase.update({
      where: { id },
      data: updateData,
    });

    const authorName =
      [user?.firstName, user?.lastName].filter(Boolean).join(' ') || null;

    if (statusChange) {
      await prisma.pxComment.create({
        data: {
          tenantId: tenantUuid,
          caseId: id,
          authorUserId: userId,
          authorName,
          kind: RESOLVED_STATES.has(statusChange.to as PxStatus) ? 'RESOLUTION' : 'STATUS_CHANGE',
          body: `Status: ${statusChange.from} → ${statusChange.to}`,
          metadata: statusChange,
        },
      });
    }
    if (assigneeChange) {
      await prisma.pxComment.create({
        data: {
          tenantId: tenantUuid,
          caseId: id,
          authorUserId: userId,
          authorName,
          kind: 'ASSIGNMENT',
          body: assigneeChange.to
            ? `Reassigned to ${assigneeChange.to}`
            : 'Assignment cleared',
          metadata: assigneeChange,
        },
      });
    }

    return NextResponse.json({ success: true, case: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'px.cases.edit' },
);
