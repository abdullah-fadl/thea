import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const routeParams = params || {};
  const encounterId = String((routeParams as Record<string, string>).encounterId || '');
  if (!encounterId) {
    return NextResponse.json({ error: 'Encounter ID is required' }, { status: 400 });
  }

  const doneTasks = await prisma.erTask.findMany({
    where: { encounterId, status: 'DONE' },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });

  const pendingReview = doneTasks.filter((t: any) => !t.resultAcknowledgedAt);
  return NextResponse.json({
    items: doneTasks,
    pendingReviewCount: pendingReview.length,
    totalDoneCount: doneTasks.length,
  });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.encounter.view' }
);
