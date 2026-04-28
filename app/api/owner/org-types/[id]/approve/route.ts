import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/core/owner/separation';
import { requireAuthContext } from '@/lib/auth/requireAuthContext';
import { prisma } from '@/lib/db/prisma';
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

    const existing = await prisma.organizationType.findFirst({ where: { id: orgTypeId } });
    if (!existing) {
      return NextResponse.json({ error: 'Organization type not found' }, { status: 404 });
    }

    await prisma.organizationType.update({
      where: { id: orgTypeId },
      data: { status: 'ACTIVE' },
    });

    return NextResponse.json({ success: true });
});
