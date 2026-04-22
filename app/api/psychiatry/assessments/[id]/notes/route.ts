import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }, params?: unknown) => {
    const assessmentId = String((params as Record<string, unknown>)?.id || '').trim();
    if (!assessmentId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const body = await req.json();
    const note = await prisma.psychNote.create({
      data: {
        tenantId,
        assessmentId,
        authorId: body.authorId || userId,
        noteType: body.noteType || 'PROGRESS',
        content: body.content,
        medications: body.medications ?? null,
        moodRating: body.moodRating != null ? Number(body.moodRating) : null,
        suicidalRisk: body.suicidalRisk || null,
      },
    });
    return NextResponse.json({ note }, { status: 201 });
  }),
  { permissionKey: 'psychiatry.manage' },
);
