import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ICU_UNITS = ['ICU', 'CCU', 'NICU', 'PICU'];

export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }) => {
    // Active ICU episodes (IPD episodes with ICU/CCU/NICU/PICU unit)
    const episodes = await prisma.ipdEpisode.findMany({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'ADMITTED'] },
      },
      select: {
        id: true,
        status: true,
        location: true,
        riskFlags: true,
        createdAt: true,
        ownership: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    // Filter to ICU units only
    const icuEpisodes = episodes.filter((ep) => {
      const unit = (ep.location as Record<string, unknown> | null)?.unit as string || '';
      return ICU_UNITS.some((u) => unit.toUpperCase().includes(u));
    });

    // KPIs
    let ventilatedCount = 0;
    let criticalCount = 0;    // MEWS ≥ 7
    let stableCount = 0;      // MEWS < 3
    let sofa13Plus = 0;       // SOFA ≥ 13 (very high / critical)

    for (const ep of icuEpisodes) {
      const assessment = (ep as unknown as { latestAssessment?: any }).latestAssessment;
      const mews = (assessment?.mewsScore as number | null) ?? null;
      const icuMon = assessment?.icuMonitoring as Record<string, unknown> | undefined;

      if ((icuMon?.ventilator as Record<string, unknown>[] | undefined)?.length) ventilatedCount++;
      if (mews !== null && mews >= 7) criticalCount++;
      if (mews !== null && mews < 3) stableCount++;

      // Check latest SOFA from icuMonitoring if stored
      const sofaTotal = (icuMon?.latestSofaTotal as number | null) ?? null;
      if (sofaTotal !== null && sofaTotal >= 13) sofa13Plus++;
    }

    // Recent ICU events (last 24h)
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEvents = await prisma.ipdIcuEvent.findMany({
      where: {
        tenantId,
        createdAt: { gte: since24h },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        type: true,
        source: true,
        destination: true,
        note: true,
        createdAt: true,
        episodeId: true,
      },
    });

    // Admission sources (last 7 days)
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const admitEvents = await prisma.ipdIcuEvent.findMany({
      where: { tenantId, type: 'ADMIT', createdAt: { gte: since7d } },
      select: { source: true },
      take: 200,
    });
    const admissionSources: Record<string, number> = {};
    for (const ev of admitEvents) {
      const src = ev.source || 'UNKNOWN';
      admissionSources[src] = (admissionSources[src] || 0) + 1;
    }

    // Length of stay for current patients
    const losData = icuEpisodes.map((ep) => ({
      episodeId: ep.id,
      admittedAt: ep.createdAt,
      losDays: Math.floor((Date.now() - new Date(ep.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
    }));
    const avgLosDays =
      losData.length > 0
        ? Math.round(losData.reduce((s: number, d) => s + d.losDays, 0) / losData.length)
        : 0;
    const longStay = losData.filter((d) => d.losDays >= 7).length;

    return NextResponse.json({
      census: {
        total: icuEpisodes.length,
        ventilated: ventilatedCount,
        critical: criticalCount,
        stable: stableCount,
        highSofa: sofa13Plus,
      },
      los: {
        avgDays: avgLosDays,
        longStayCount: longStay,  // ≥7 days
      },
      admissionSources,
      recentEvents,
      units: ICU_UNITS,
    });
  }),
  { tenantScoped: true, permissionKey: 'icu.nurse.view' }
);
