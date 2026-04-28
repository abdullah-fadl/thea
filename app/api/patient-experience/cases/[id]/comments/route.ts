import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { resolvePxTenantUuid } from '@/lib/patient-experience/tenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const commentSchema = z.object({
  body: z.string().trim().min(1).max(8000),
});

/**
 * POST /api/patient-experience/cases/[id]/comments
 *
 * Adds a free-text COMMENT entry to the case timeline.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
    const id = String((await params)?.id ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid case id' }, { status: 400 });
    }
    const resolved = await resolvePxTenantUuid(tenantId);
    if (resolved instanceof NextResponse) return resolved;
    const { tenantUuid } = resolved;

    const parsed = commentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const exists = await prisma.pxCase.findFirst({
      where: { id, tenantId: tenantUuid },
      select: { id: true },
    });
    if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const created = await prisma.pxComment.create({
      data: {
        tenantId: tenantUuid,
        caseId: id,
        authorUserId: userId,
        authorName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || null,
        kind: 'COMMENT',
        body: parsed.data.body,
      },
    });

    return NextResponse.json({ success: true, comment: created }, { status: 201 });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'px.cases.comment' },
);
