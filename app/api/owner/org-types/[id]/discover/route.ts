import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/core/owner/separation';
import { requireAuthContext } from '@/lib/auth/requireAuthContext';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { buildDefaultContextPack } from '@/lib/sam/tenantContext';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

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
    if (!orgTypeId) {
      return NextResponse.json({ error: 'Organization type ID is required' }, { status: 400 });
    }

    const orgType = await prisma.organizationType.findFirst({ where: { id: orgTypeId } });
    if (!orgType) {
      return NextResponse.json({ error: 'Organization type not found' }, { status: 404 });
    }

    const proposalPack = buildDefaultContextPack({
      tenantId: 'proposal',
      orgTypeId: orgType.id,
      orgTypeNameSnapshot: orgType.name,
      sectorSnapshot: orgType.sector,
      countryCode: orgType.countryCode || null,
      status: 'PENDING_REVIEW',
    });

    const proposal = await prisma.organizationTypeProposal.create({
      data: {
        orgTypeId: orgType.id,
        status: 'PENDING_REVIEW',
        proposal: proposalPack as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ success: true, data: proposal });
});
