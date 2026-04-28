import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/core/owner/separation';
import { requireAuthContext } from '@/lib/auth/requireAuthContext';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

const updateProposalSchema = z.object({
  proposal: z.record(z.string(), z.any()),
});

export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const authContext = await requireAuthContext(request, true);
    if (authContext instanceof NextResponse) {
      return authContext;
    }
    if (authContext.tenantId !== 'platform') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Platform access required' },
        { status: 403 }
      );
    }

    const orgTypeId = params.id;
    const proposal = await prisma.organizationTypeProposal.findFirst({
      where: { orgTypeId },
    });

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: proposal });
});

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const authContext = await requireAuthContext(request, true);
    if (authContext instanceof NextResponse) {
      return authContext;
    }
    if (authContext.tenantId !== 'platform') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Platform access required' },
        { status: 403 }
      );
    }

    const orgTypeId = params.id;
    const body = await request.json();
    const v = validateBody(body, updateProposalSchema);
    if ('error' in v) return v.error;
    const { proposal } = v.data;

    const existing = await prisma.organizationTypeProposal.findFirst({
      where: { orgTypeId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    await prisma.organizationTypeProposal.update({
      where: { id: existing.id },
      data: { proposal: proposal as Prisma.InputJsonValue },
    });

    return NextResponse.json({ success: true });
});
