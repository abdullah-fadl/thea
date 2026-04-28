import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { createAuditContext, logAuditEvent } from '@/lib/security/audit';
import { validateBody } from '@/lib/validation/helpers';
import { createDraftVersionSchema } from '@/lib/validation/sam.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, user, userId, role }, params) => {
  try {
    const draftId = (params as Record<string, string>)?.draftId as string | undefined;
    if (!draftId) {
      return NextResponse.json({ error: 'draftId is required' }, { status: 400 });
    }
    const rawBody = await req.json();
    const v = validateBody(rawBody, createDraftVersionSchema);
    if ('error' in v) return v.error;
    const body = v.data;

    const draft: any = await prisma.draftDocument.findFirst({ where: { tenantId, id: draftId } });
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    const now = new Date();
    const nextVersion = Number(draft.latestVersion || 0) + 1;
    const newVersion = {
      version: nextVersion,
      content: body.content,
      createdAt: now,
      createdBy: userId,
      model: 'human_edit',
      inputs: {
        message: body.message || null,
      },
    };

    // Append new version to the versions JSON array
    const existingVersions = Array.isArray(draft.versions) ? draft.versions : [];
    const updatedVersions = [...existingVersions, newVersion];

    await prisma.draftDocument.updateMany({
      where: { tenantId, id: draftId },
      data: {
        latestContent: body.content,
        latestVersion: nextVersion,
        versions: updatedVersions as Prisma.InputJsonValue,
        updatedAt: now,
        updatedBy: userId,
      } as Prisma.InputJsonValue,
    });

    const auditContext = createAuditContext(
      { userId, userRole: role, userEmail: user?.email, tenantId },
      {
        ip: req.headers.get('x-forwarded-for') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
        method: req.method,
        path: req.nextUrl.pathname,
      }
    );
    await logAuditEvent(auditContext, 'draft_version_created', 'draft_document', {
      resourceId: draftId,
      metadata: {
        draftId,
        version: nextVersion,
        message: body.message || null,
      },
    });

    return NextResponse.json({ success: true, version: nextVersion });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to create draft version' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true });
