import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function resolveDraftId(params: unknown): Promise<string | null> {
  const resolvedParams = params instanceof Promise ? await params : params;
  const id = String((resolvedParams as Record<string, string>)?.draftId || '').trim();
  return id || null;
}

export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }, params) => {
    try {
      const draftId = await resolveDraftId(params);
      if (!draftId) {
        return NextResponse.json({ error: 'draftId is required' }, { status: 400 });
      }

      const draft = await prisma.draftDocument.findFirst({ where: { tenantId, id: draftId } });
      if (!draft) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
      }

      return NextResponse.json({ draft });
    } catch (error: unknown) {
      logger.error('Draft GET error:', { error });
      return NextResponse.json(
        { error: 'Failed to load draft' },
        { status: 500 }
      );
    }
  }),
  { platformKey: 'sam', tenantScoped: true }
);

const updateDraftSchema = z.object({
  title: z.string().optional(),
  departmentId: z.string().nullable().optional(),
  status: z.enum(['draft', 'in_review', 'approved', 'published', 'archived']).optional(),
  documentType: z.string().optional(),
  latestContent: z.string().optional(),
});

/**
 * PATCH /api/sam/drafts/[draftId] — Update draft metadata
 */
export const PATCH = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }, params) => {
    try {
      const draftId = await resolveDraftId(params);
      if (!draftId) {
        return NextResponse.json({ error: 'draftId is required' }, { status: 400 });
      }

      const body = await req.json();
      const v = validateBody(body, updateDraftSchema);
      if ('error' in v) return v.error;

      const existing = await prisma.draftDocument.findFirst({ where: { tenantId, id: draftId } });
      if (!existing) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
      }

      const updateData: Record<string, unknown> = { updatedBy: userId, updatedAt: new Date() };
      if (v.data.title !== undefined) updateData.title = v.data.title;
      if (v.data.departmentId !== undefined) updateData.departmentId = v.data.departmentId;
      if (v.data.status !== undefined) updateData.status = v.data.status;
      if (v.data.documentType !== undefined) updateData.documentType = v.data.documentType;
      if (v.data.latestContent !== undefined) updateData.latestContent = v.data.latestContent;

      const updated = await prisma.draftDocument.update({
        where: { id: draftId },
        data: updateData,
      });

      return NextResponse.json({ draft: updated });
    } catch (error: unknown) {
      logger.error('Draft PATCH error:', { error });
      return NextResponse.json(
        { error: 'Failed to update draft' },
        { status: 500 }
      );
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.drafts.manage' }
);

/**
 * DELETE /api/sam/drafts/[draftId] — Delete a draft
 */
export const DELETE = withAuthTenant(
  withErrorHandler(async (req, { tenantId }, params) => {
    try {
      const draftId = await resolveDraftId(params);
      if (!draftId) {
        return NextResponse.json({ error: 'draftId is required' }, { status: 400 });
      }

      const existing = await prisma.draftDocument.findFirst({ where: { tenantId, id: draftId } });
      if (!existing) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
      }

      if (existing.status === 'published') {
        return NextResponse.json({ error: 'Cannot delete a published draft' }, { status: 400 });
      }

      await prisma.draftDocument.delete({ where: { id: draftId } });

      return NextResponse.json({ success: true });
    } catch (error: unknown) {
      logger.error('Draft DELETE error:', { error });
      return NextResponse.json(
        { error: 'Failed to delete draft' },
        { status: 500 }
      );
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.drafts.manage' }
);
