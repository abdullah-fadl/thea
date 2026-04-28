import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const caseId = String((params as Record<string, string>)?.caseId || '').trim();
  if (!caseId) {
    return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
  }

  const mortuaryCase = await prisma.mortuaryCase.findFirst({
    where: { tenantId, id: caseId },
  });
  if (!mortuaryCase) {
    return NextResponse.json({ error: 'Mortuary case not found' }, { status: 404 });
  }

  return NextResponse.json({ mortuaryCase });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'mortuary.view' });
