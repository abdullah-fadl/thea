import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user }) => {

  const role = String((user as unknown as Record<string, unknown>)?.role || '');
  const dev = false;
  const roleLower = role.toLowerCase();
  const isNurse = roleLower.includes('nurse') || roleLower.includes('nursing');
  if (!dev && !isNurse && !canAccessChargeConsole({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const episodes = await prisma.ipdEpisode.findMany({
    where: { tenantId, status: { in: ['ACTIVE', 'DISCHARGE_READY'] } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const enriched = await Promise.all(
    episodes.map(async (ep) => {
      const [latestVitalsArr, latestAssessmentArr] = await Promise.all([
        prisma.ipdVitals.findMany({
          where: { tenantId, episodeId: ep.id },
          orderBy: { createdAt: 'desc' },
          take: 1,
        }),
        prisma.ipdNursingAssessment.findMany({
          where: { tenantId, episodeId: ep.id },
          orderBy: { createdAt: 'desc' },
          take: 1,
        }),
      ]);

      return {
        ...ep,
        patientName: (ep.patient as Record<string, unknown>)?.fullName || 'Unknown',
        latestVitals: latestVitalsArr[0]?.vitals || null,
        latestAssessment: latestAssessmentArr[0]
          ? {
              mewsScore: latestAssessmentArr[0].mewsScore,
              mewsLevel: latestAssessmentArr[0].mewsLevel,
              bradenScore: latestAssessmentArr[0].bradenScore,
              bradenRisk: latestAssessmentArr[0].bradenRisk,
              fallRiskScore: latestAssessmentArr[0].fallRiskScore,
              fallRiskLevel: latestAssessmentArr[0].fallRiskLevel,
              consciousness: latestAssessmentArr[0].consciousness,
            }
          : null,
      };
    }),
  );

  return NextResponse.json({ items: enriched });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);
