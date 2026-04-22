import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = String(resolvedParams?.id || '');

    if (!id) {
      return NextResponse.json({ error: 'Missing assessment id' }, { status: 400 });
    }

    const assessment = await prisma.socialWorkAssessment.findFirst({
      where: { id, tenantId },
    });
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { content, noteType } = body;

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const note = await prisma.socialWorkNote.create({
      data: {
        tenantId,
        assessmentId: id,
        authorId: userId,
        content: String(content),
        noteType: noteType ? String(noteType) : 'GENERAL',
      },
    });

    return NextResponse.json({ success: true, note });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'social_work.manage' }
);
