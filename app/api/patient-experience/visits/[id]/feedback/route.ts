import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { resolvePxTenantUuid } from '@/lib/patient-experience/tenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/patient-experience/visits/[id]/feedback
 *
 * Returns the visit-experience signal + linked PxCases (by visitId match).
 * The :id parameter is the PxVisitExperience.id (not the encounter id), so
 * the page can fetch a single row regardless of whether visitId is set.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const id = String((await params)?.id ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }
    const resolved = await resolvePxTenantUuid(tenantId);
    if (resolved instanceof NextResponse) return resolved;
    const { tenantUuid } = resolved;

    const visit = await prisma.pxVisitExperience.findFirst({
      where: { id, tenantId: tenantUuid },
    });
    if (!visit) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const linkedCases = visit.visitId
      ? await prisma.pxCase.findMany({
          where: { tenantId: tenantUuid, visitId: visit.visitId, active: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : [];

    return NextResponse.json({ success: true, visit, linkedCases });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'px.visits.view' },
);
