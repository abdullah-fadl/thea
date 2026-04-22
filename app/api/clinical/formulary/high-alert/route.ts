import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET — List all high-alert medications
export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }) => {
    const items = await prisma.formularyDrug.findMany({
      where: { tenantId, highAlert: true, isActive: true },
      orderBy: { genericName: 'asc' },
      take: 500,
    });

    return NextResponse.json({ items, total: items.length });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'formulary.view' }
);
