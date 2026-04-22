import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/risk-detector/runs
 * Get all risk runs for the current user/tenant
 * Query params: departmentId?, setting?
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { tenantId } = authResult;

  const { searchParams } = new URL(request.url);
  const departmentId = searchParams.get('departmentId');
  const setting = searchParams.get('setting') as 'IPD' | 'OPD' | 'Corporate' | 'Shared' | null;

  const where: any = { tenantId };
  if (departmentId) {
    where.departmentId = departmentId;
  }
  if (setting) {
    where.setting = setting;
  }

  const runs = await prisma.riskRun.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({
    success: true,
    runs: runs.map((run: any) => ({
      id: run.id,
      departmentId: run.departmentId,
      setting: run.setting,
      inputPracticeIds: run.inputPracticeIds,
      resultsJson: run.resultsJson,
      createdAt: run.createdAt,
      createdBy: run.createdBy,
    })),
  });
});
