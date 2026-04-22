import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { evaluateWestgard, calculateZScore, type QCResult } from '@/lib/lab/qualityControl';

const qcEntrySchema = z.object({
  analyteCode: z.string().min(1),
  analyteName: z.object({ ar: z.string(), en: z.string() }).optional(),
  lotNumber: z.string().min(1),
  level: z.number(),
  value: z.number(),
  mean: z.number(),
  sd: z.number().positive(),
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const analyteCode = req.nextUrl.searchParams.get('analyteCode');
    const lotNumber = req.nextUrl.searchParams.get('lotNumber');
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 30), 100);

    const filter: Record<string, unknown> = { tenantId };
    if (analyteCode) filter.analyteCode = analyteCode.toUpperCase();
    if (lotNumber) filter.lotNumber = lotNumber;

    const results = await prisma.labQcResult.findMany({
      where: filter,
      orderBy: { performedAt: 'desc' },
      take: limit,
    });

    // Get distinct analytes for dropdown using groupBy
    const analyteGroups = await prisma.labQcResult.groupBy({
      by: ['analyteCode'],
      where: { tenantId },
      orderBy: { analyteCode: 'asc' },
    });

    // Fetch one record per analyte to get name and lotNumber
    const analytes = await Promise.all(
      analyteGroups.map(async (g) => {
        const record = await prisma.labQcResult.findFirst({
          where: { tenantId, analyteCode: g.analyteCode },
          select: { analyteCode: true, analyteName: true, lotNumber: true },
        });
        return {
          code: g.analyteCode,
          name: record?.analyteName,
          lotNumber: record?.lotNumber,
        };
      })
    );

    return NextResponse.json({ results, analytes });
  }),
  { tenantScoped: true, permissionKey: 'lab.results.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, qcEntrySchema);
    if ('error' in v) return v.error;
    const { analyteCode, analyteName, lotNumber, level, value, mean, sd } = v.data;

    // Fetch recent history for multi-rule evaluation
    const history = await prisma.labQcResult.findMany({
      where: { tenantId, analyteCode: analyteCode.toUpperCase(), lotNumber, level: String(level) },
      orderBy: { performedAt: 'desc' },
      take: 10,
      select: { zScore: true },
    });

    const historyZScores = history.map((h: any) => Number(h.zScore));

    const evaluation = evaluateWestgard(value, mean, sd, historyZScores);

    const qcResult: QCResult = {
      id: uuidv4(),
      analyteCode: analyteCode.toUpperCase(),
      analyteName,
      lotNumber,
      level,
      value,
      mean,
      sd,
      zScore: evaluation.zScore,
      performedAt: new Date().toISOString(),
      performedBy: userId,
      violations: evaluation.violations,
      status: evaluation.status,
    };

    await prisma.labQcResult.create({
      data: {
        id: qcResult.id,
        analyteCode: qcResult.analyteCode,
        analyteName: analyteName as unknown as string,
        lotNumber: qcResult.lotNumber,
        level: String(qcResult.level),
        value: qcResult.value,
        mean: qcResult.mean,
        sd: qcResult.sd,
        zScore: qcResult.zScore,
        performedAt: qcResult.performedAt,
        performedBy: qcResult.performedBy,
        violations: evaluation.violations as any,
        status: qcResult.status,
        tenantId,
        createdAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      qcResult,
      westgard: {
        status: evaluation.status,
        violations: evaluation.violations,
        zScore: evaluation.zScore,
      },
    });
  }),
  { tenantScoped: true, permissionKey: 'lab.results.create' },
);
