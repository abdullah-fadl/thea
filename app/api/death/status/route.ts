import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const { searchParams } = new URL(req.url);
    const encounterCoreId = String(searchParams.get('encounterCoreId') || '').trim();
    if (!encounterCoreId) {
      return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
    }

    const declaration = await prisma.deathDeclaration.findFirst({
      where: { tenantId, encounterCoreId },
    });

    const mortuaryCase = await prisma.mortuaryCase.findFirst({
      where: { tenantId, encounterCoreId },
    });

    return NextResponse.json({ declaration: declaration || null, mortuaryCase: mortuaryCase || null });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical.edit' }
);
