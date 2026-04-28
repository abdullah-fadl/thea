import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { resolvePxTenantUuid } from '@/lib/patient-experience/tenant';
import { computePxKpis, type PxCaseRow } from '@/lib/patient-experience/kpis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/patient-experience/kpis?days=30
 *
 * Returns the dashboard KPI block for the requested rolling window
 * (default 30 days, capped to 365). Tenant-scoped.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const resolved = await resolvePxTenantUuid(tenantId);
    if (resolved instanceof NextResponse) return resolved;
    const { tenantUuid } = resolved;

    const url = new URL(req.url);
    const daysParam = Number(url.searchParams.get('days') ?? '30');
    const days = Number.isFinite(daysParam)
      ? Math.min(365, Math.max(1, Math.trunc(daysParam)))
      : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const cases = (await prisma.pxCase.findMany({
      where: { tenantId: tenantUuid, createdAt: { gte: since }, active: true },
      select: {
        id: true,
        status: true,
        severity: true,
        categoryKey: true,
        satisfactionScore: true,
        resolutionMinutes: true,
        escalationLevel: true,
        dueAt: true,
        resolvedAt: true,
        createdAt: true,
      },
    })) as unknown as PxCaseRow[];

    const recent = await prisma.pxCase.findMany({
      where: { tenantId: tenantUuid, active: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        caseNumber: true,
        status: true,
        severity: true,
        categoryKey: true,
        subjectName: true,
        createdAt: true,
        dueAt: true,
        escalationLevel: true,
      },
    });

    const kpis = computePxKpis(cases);
    return NextResponse.json({ success: true, windowDays: days, kpis, recent });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'px.dashboard.view' },
);
