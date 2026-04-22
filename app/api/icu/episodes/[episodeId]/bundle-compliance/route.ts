import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const episodeId = String((params as Record<string, string> | undefined)?.episodeId || '').trim();
    if (!episodeId) return NextResponse.json({ error: 'Missing episodeId' }, { status: 400 });

    const url = new URL(req.url);
    const bundleType = url.searchParams.get('bundleType') || undefined;

    const where: any = { episodeId, tenantId };
    if (bundleType && bundleType !== 'ALL') {
      where.bundleType = bundleType;
    }

    const audits = await prisma.icuBundleCompliance.findMany({
      where,
      orderBy: { auditDate: 'desc' },
      take: 100,
    });

    // Compute aggregate KPIs per bundle type
    const allAudits = await prisma.icuBundleCompliance.findMany({
      where: { episodeId, tenantId },
      orderBy: { auditDate: 'desc' },
      take: 200,
    });

    const kpis: Record<string, { total: number; sumPercent: number }> = {
      VAP: { total: 0, sumPercent: 0 },
      CLABSI: { total: 0, sumPercent: 0 },
      CAUTI: { total: 0, sumPercent: 0 },
    };

    for (const a of allAudits) {
      const bt = a.bundleType as string;
      if (kpis[bt]) {
        kpis[bt].total += 1;
        kpis[bt].sumPercent += Number(a.compliancePercent || 0);
      }
    }

    const summary = Object.fromEntries(
      Object.entries(kpis).map(([key, val]) => [
        key,
        {
          count: val.total,
          avgCompliance: val.total > 0 ? Math.round(val.sumPercent / val.total) : 0,
        },
      ]),
    );

    const overallTotal = allAudits.length;
    const overallSum = allAudits.reduce((s: number, a: { compliancePercent?: number | null }) => s + Number(a.compliancePercent || 0), 0);
    const overallAvg = overallTotal > 0 ? Math.round(overallSum / overallTotal) : 0;

    return NextResponse.json({ audits, summary, overallAvg });
  }),
  { permissionKey: 'icu.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const episodeId = String((params as Record<string, string> | undefined)?.episodeId || '').trim();
    if (!episodeId) return NextResponse.json({ error: 'Missing episodeId' }, { status: 400 });

    const body = await req.json();
    const {
      bundleType,
      elements,
      deviationNotes,
      actionPlan,
      lineInsertionDate,
      plannedRemovalDate,
    } = body;

    if (!bundleType || !['VAP', 'CLABSI', 'CAUTI'].includes(bundleType)) {
      return NextResponse.json({ error: 'Invalid bundleType' }, { status: 400 });
    }
    if (!elements || !Array.isArray(elements)) {
      return NextResponse.json({ error: 'Missing elements array' }, { status: 400 });
    }

    const compliantCount = elements.filter((e: { compliant?: boolean }) => e.compliant).length;
    const totalElements = elements.length;
    const compliancePercent = totalElements > 0 ? Math.round((compliantCount / totalElements) * 100) : 0;

    const audit = await prisma.icuBundleCompliance.create({
      data: {
        tenantId,
        episodeId,
        bundleType,
        auditDate: new Date(),
        auditorId: userId,
        elements: JSON.stringify(elements),
        compliantCount,
        totalElements,
        compliancePercent,
        deviationNotes: deviationNotes || null,
        actionPlan: actionPlan || null,
        lineInsertionDate: lineInsertionDate ? new Date(lineInsertionDate) : null,
        plannedRemovalDate: plannedRemovalDate ? new Date(plannedRemovalDate) : null,
      } as any,
    });

    return NextResponse.json({ audit }, { status: 201 });
  }),
  { permissionKey: 'icu.view' },
);
