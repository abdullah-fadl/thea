import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { resultsViewedSchema } from '@/lib/validation/opd.schema';

import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {

  const encounterCoreId = String((params as Record<string, string>)?.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
  if (deathGuard) return deathGuard;

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, resultsViewedSchema);
  if ('error' in v) return v.error;
  const { resultId } = v.data;

  const opd = await prisma.opdEncounter.findUnique({
    where: { encounterCoreId },
  });
  if (!opd) {
    return NextResponse.json({ error: 'OPD encounter not found' }, { status: 404 });
  }

  // Check if already viewed by this user
  const existing = await prisma.opdResultViewed.findFirst({
    where: { opdEncounterId: opd.id, resultId, viewedBy: userId || '' },
  });
  if (existing) {
    return NextResponse.json({ success: true, noOp: true });
  }

  const entry = await prisma.opdResultViewed.create({
    data: {
      opdEncounterId: opd.id,
      resultId,
      viewedAt: new Date(),
      viewedBy: userId || '',
    },
  });

  return NextResponse.json({ success: true, entry });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.view' }
);
