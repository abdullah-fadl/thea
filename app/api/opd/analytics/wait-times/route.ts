// =============================================================================
// OPD Analytics — Wait Times
// GET /api/opd/analytics/wait-times?days=7|30|90
// =============================================================================
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get('days') || '7');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const encounters = await prisma.opdEncounter
      .findMany({
        where: {
          tenantId,
          createdAt: { gte: startDate },
          arrivedAt: { not: null },
          doctorStartAt: { not: null },
        },
        select: { arrivedAt: true, doctorStartAt: true },
        take: 1000,
      })
      .catch(() => [] as { arrivedAt: Date | null; doctorStartAt: Date | null }[]);

    const total = await prisma.opdEncounter
      .count({ where: { tenantId, createdAt: { gte: startDate } } })
      .catch(() => 0);

    const waitTimes: number[] = [];
    for (const enc of encounters) {
      if (enc.arrivedAt && enc.doctorStartAt) {
        const waitMin = Math.round(
          (new Date(enc.doctorStartAt).getTime() - new Date(enc.arrivedAt).getTime()) / 60000,
        );
        if (waitMin >= 0 && waitMin <= 300) waitTimes.push(waitMin);
      }
    }

    const avg =
      waitTimes.length > 0
        ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
        : 0;

    function pct(arr: number[], p: number) {
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.min(Math.floor((p / 100) * s.length), s.length - 1)] ?? 0;
    }

    const distribution: Record<string, number> = {
      '0-15': 0, '16-30': 0, '31-60': 0, '61-120': 0, '120+': 0,
    };
    for (const w of waitTimes) {
      if (w <= 15) distribution['0-15']++;
      else if (w <= 30) distribution['16-30']++;
      else if (w <= 60) distribution['31-60']++;
      else if (w <= 120) distribution['61-120']++;
      else distribution['120+']++;
    }

    return NextResponse.json({
      avgWaitMinutes: avg,
      p50WaitMinutes: pct(waitTimes, 50),
      p90WaitMinutes: pct(waitTimes, 90),
      totalEncounters: total,
      analyzedEncounters: waitTimes.length,
      distribution,
      period: days,
    });
  }),
  { permissionKey: 'opd.analytics.view' },
);
