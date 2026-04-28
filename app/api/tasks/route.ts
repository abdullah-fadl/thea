import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const params = req.nextUrl.searchParams;
  const encounterCoreId = String(params.get('encounterCoreId') || '').trim();
  const statusParam = String(params.get('status') || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const filter: any = { tenantId, encounterCoreId };
  if (statusParam) {
    const statuses = statusParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (statuses.length) filter.status = { in: statuses };
  }

  const tasks = await prisma.clinicalTask.findMany({
    where: filter,
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  return NextResponse.json({ items: tasks });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'tasks.queue.view' }
);
