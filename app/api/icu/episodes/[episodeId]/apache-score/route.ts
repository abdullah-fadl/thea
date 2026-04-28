import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ------------------------------------------------------------------ */
/*  APACHE II predicted mortality (Knaus et al. 1985 approximation)   */
/* ------------------------------------------------------------------ */
function predictedMortality(totalScore: number): number {
  if (totalScore <= 4) return 4;
  if (totalScore <= 9) return 8;
  if (totalScore <= 14) return 15;
  if (totalScore <= 19) return 25;
  if (totalScore <= 24) return 40;
  if (totalScore <= 29) return 55;
  if (totalScore <= 34) return 73;
  return 85;
}

function riskCategory(totalScore: number): string {
  if (totalScore <= 4) return 'LOW';
  if (totalScore <= 9) return 'MODERATE';
  if (totalScore <= 14) return 'HIGH';
  if (totalScore <= 19) return 'VERY_HIGH';
  return 'CRITICAL';
}

/* ------------------------------------------------------------------ */
/*  GET  /api/icu/episodes/[episodeId]/apache-score                   */
/* ------------------------------------------------------------------ */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const episodeId = String((params as Record<string, string>)?.episodeId || '').trim();
    if (!episodeId) {
      return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
    }

    const scores = await (prisma as Record<string, any>).icuApacheScore.findMany({
      where: { tenantId, episodeId },
      orderBy: { scoredAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ scores });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'icu.view' },
);

/* ------------------------------------------------------------------ */
/*  POST  /api/icu/episodes/[episodeId]/apache-score                  */
/* ------------------------------------------------------------------ */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const episodeId = String((params as Record<string, string>)?.episodeId || '').trim();
    if (!episodeId) {
      return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
    }

    const body = await req.json();

    // APS (Acute Physiology Score) — sum of 12 individual component scores (each 0-4)
    const temperatureScore = Number(body.temperatureScore ?? 0);
    const mapScore = Number(body.mapScore ?? 0);
    const heartRateScore = Number(body.heartRateScore ?? 0);
    const respiratoryRateScore = Number(body.respiratoryRateScore ?? 0);
    const oxygenationScore = Number(body.oxygenationScore ?? 0);
    const arterialPhScore = Number(body.arterialPhScore ?? 0);
    const sodiumScore = Number(body.sodiumScore ?? 0);
    const potassiumScore = Number(body.potassiumScore ?? 0);
    const creatinineScore = Number(body.creatinineScore ?? 0);
    const hematocritScore = Number(body.hematocritScore ?? 0);
    const wbcScore = Number(body.wbcScore ?? 0);
    const gcsScore = Number(body.gcsScore ?? 0);

    const apsTotal =
      temperatureScore + mapScore + heartRateScore + respiratoryRateScore +
      oxygenationScore + arterialPhScore + sodiumScore + potassiumScore +
      creatinineScore + hematocritScore + wbcScore + gcsScore;

    const agePoints = Number(body.agePoints ?? 0);
    const chronicHealthPoints = Number(body.chronicHealthPoints ?? 0);

    const totalScore = apsTotal + agePoints + chronicHealthPoints;
    const mortality = predictedMortality(totalScore);
    const risk = riskCategory(totalScore);

    const score = await (prisma as Record<string, any>).icuApacheScore.create({
      data: {
        tenantId,
        episodeId,
        scoredAt: new Date(),
        scoredBy: body.scoredBy || userId,
        // Raw values
        temperature: body.temperature != null ? Number(body.temperature) : null,
        meanArterialPressure: body.meanArterialPressure != null ? Number(body.meanArterialPressure) : null,
        heartRate: body.heartRate != null ? Number(body.heartRate) : null,
        respiratoryRate: body.respiratoryRate != null ? Number(body.respiratoryRate) : null,
        fio2: body.fio2 != null ? Number(body.fio2) : null,
        pao2: body.pao2 != null ? Number(body.pao2) : null,
        aaDO2: body.aaDO2 != null ? Number(body.aaDO2) : null,
        arterialPh: body.arterialPh != null ? Number(body.arterialPh) : null,
        sodium: body.sodium != null ? Number(body.sodium) : null,
        potassium: body.potassium != null ? Number(body.potassium) : null,
        creatinine: body.creatinine != null ? Number(body.creatinine) : null,
        hematocrit: body.hematocrit != null ? Number(body.hematocrit) : null,
        wbc: body.wbc != null ? Number(body.wbc) : null,
        gcs: body.gcs != null ? Number(body.gcs) : null,
        // Individual APS component scores
        temperatureScore,
        mapScore,
        heartRateScore,
        respiratoryRateScore,
        oxygenationScore,
        arterialPhScore,
        sodiumScore,
        potassiumScore,
        creatinineScore,
        hematocritScore,
        wbcScore,
        gcsScore,
        // Age + chronic
        agePoints,
        chronicHealthPoints,
        chronicLiver: !!body.chronicLiver,
        chronicCardiovascular: !!body.chronicCardiovascular,
        chronicRespiratory: !!body.chronicRespiratory,
        chronicRenal: !!body.chronicRenal,
        chronicImmunocompromised: !!body.chronicImmunocompromised,
        emergencySurgery: !!body.emergencySurgery,
        // Totals
        apsTotal,
        totalScore,
        predictedMortality: mortality,
        riskCategory: risk,
        notes: body.notes || null,
      },
    });

    return NextResponse.json({ score }, { status: 201 });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'icu.view' },
);
