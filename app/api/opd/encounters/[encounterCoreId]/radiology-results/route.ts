import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const encounterCoreId = String((params as Record<string, string>)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const results = await prisma.radiologyReport.findMany({
    where: { tenantId, encounterId: encounterCoreId },
    orderBy: [{ createdAt: 'desc' }],
    take: 100,
  });

  return NextResponse.json({ results });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.view' }
);
