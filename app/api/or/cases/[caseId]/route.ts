import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const routeParams = params || {};
  const caseId = String((routeParams as Record<string, string>).caseId || '').trim();
  if (!caseId) {
    return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
  }

  const orCase = await prisma.orCase.findFirst({
    where: { tenantId, id: caseId },
  });
  if (!orCase) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }
  const events = await prisma.orCaseEvent.findMany({
    where: { tenantId, caseId },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  return NextResponse.json({ case: orCase, events });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);
