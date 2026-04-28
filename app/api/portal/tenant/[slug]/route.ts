import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler, NotFoundError } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Public endpoint — patients are not authenticated when they arrive here.
// Returns ONLY the minimal fields the portal login page needs.
// Never expose internal IDs, billing data, or user lists.
export const GET = withErrorHandler(
  async (
    _request: NextRequest,
    { params }: { params: { slug: string } },
  ) => {
    const { slug } = params;

    const tenant = await prisma.tenant.findFirst({
      where: { portalSlug: slug, status: 'ACTIVE' },
      select: {
        id: true,
        tenantId: true,
        name: true,
        portalSlug: true,
      },
    });

    if (!tenant) {
      throw new NotFoundError('Hospital not found');
    }

    const response = NextResponse.json({
      id: tenant.id,
      tenantId: tenant.tenantId,
      name: tenant.name ?? tenant.tenantId,
      slug: tenant.portalSlug,
    });
    response.headers.set('Cache-Control', 'public, max-age=60');
    return response;
  },
);
