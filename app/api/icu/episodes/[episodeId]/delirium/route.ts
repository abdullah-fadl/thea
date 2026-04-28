import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ------------------------------------------------------------------ */
/*  CAM-ICU positive determination                                     */
/*  Positive = Feature 1 AND Feature 2 AND (Feature 3 OR Feature 4)   */
/* ------------------------------------------------------------------ */
function isCamIcuPositive(f1: boolean, f2: boolean, f3: boolean, f4: boolean): boolean {
  return f1 && f2 && (f3 || f4);
}

function deliriumType(rassScore: number | null): string | null {
  if (rassScore == null) return null;
  if (rassScore > 0) return 'HYPERACTIVE';
  if (rassScore < 0) return 'HYPOACTIVE';
  return 'MIXED';
}

/* ------------------------------------------------------------------ */
/*  GET  /api/icu/episodes/[episodeId]/delirium                       */
/* ------------------------------------------------------------------ */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const episodeId = String((params as Record<string, string>)?.episodeId || '').trim();
    if (!episodeId) {
      return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
    }

    const screens = await (prisma as Record<string, any>).icuDeliriumScreen.findMany({
      where: { tenantId, episodeId },
      orderBy: { screenedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ screens });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'icu.view' },
);

/* ------------------------------------------------------------------ */
/*  POST  /api/icu/episodes/[episodeId]/delirium                      */
/* ------------------------------------------------------------------ */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const episodeId = String((params as Record<string, string>)?.episodeId || '').trim();
    if (!episodeId) {
      return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
    }

    const body = await req.json();

    const rassScore = body.rassScore != null ? Number(body.rassScore) : null;

    // If RASS is -4 or -5, patient is too sedated to assess
    const tooSedated = rassScore != null && rassScore <= -4;

    const feature1 = !!body.feature1AcuteOnset;
    const feature2 = !!body.feature2Inattention;
    const feature3 = !!body.feature3AlteredLOC;
    const feature4 = !!body.feature4DisorganizedThinking;
    const inattentionErrors = body.inattentionErrors != null ? Number(body.inattentionErrors) : null;

    const camIcuPositive = tooSedated ? null : isCamIcuPositive(feature1, feature2, feature3, feature4);
    const delType = camIcuPositive ? deliriumType(rassScore) : null;

    const screen = await (prisma as Record<string, any>).icuDeliriumScreen.create({
      data: {
        tenantId,
        episodeId,
        screenedAt: new Date(),
        screenedBy: body.screenedBy || userId,
        rassScore,
        tooSedated,
        feature1AcuteOnset: feature1,
        feature2Inattention: feature2,
        inattentionErrors,
        feature3AlteredLOC: feature3,
        feature4DisorganizedThinking: feature4,
        camIcuPositive,
        deliriumType: delType,
        riskFactors: body.riskFactors || [],
        nonPharmInterventions: body.nonPharmInterventions || [],
        notes: body.notes || null,
      },
    });

    return NextResponse.json({ screen }, { status: 201 });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'icu.view' },
);
