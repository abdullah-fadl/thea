import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/core/owner/separation';
import { requireAuthContext } from '@/lib/auth/requireAuthContext';
import { prisma } from '@/lib/db/prisma';
import type { OrganizationType } from '@/lib/models/OrganizationType';
import { validateBody } from '@/lib/validation/helpers';
import { createOrgTypeSchema } from '@/lib/validation/owner.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (request: NextRequest) => {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const orgTypes = await prisma.organizationType.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, data: orgTypes });
});

export const POST = withErrorHandler(async (request: NextRequest) => {
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

    const body = await request.json();
    const v = validateBody(body, createOrgTypeSchema);
    if ('error' in v) return v.error;
    const data = v.data;

    // Check for existing (case-insensitive name match, not rejected)
    const existing = await prisma.organizationType.findFirst({
      where: {
        name: { equals: data.name.trim(), mode: 'insensitive' },
        NOT: { status: 'REJECTED' },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Organization type already exists' },
        { status: 409 }
      );
    }

    const orgType = await prisma.organizationType.create({
      data: {
        name: data.name.trim(),
        sector: data.sector.trim(),
        countryCode: data.countryCode || null,
        status: 'DRAFT_PENDING_REVIEW',
      },
    });

    return NextResponse.json({ success: true, data: orgType }, { status: 201 });
});
