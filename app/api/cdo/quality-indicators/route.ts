/**
 * CDO Quality Indicators API
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { CDORepository } from '@/lib/cdo/repositories/CDORepository';
import { CDODashboardService } from '@/lib/cdo/services/CDODashboardService';
import { withErrorHandler } from '@/lib/core/errors';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const indicatorType = searchParams.get('indicatorType') as string | null;
  const periodStartParam = searchParams.get('periodStart');
  const periodEndParam = searchParams.get('periodEnd');
  const careSetting = searchParams.get('careSetting') as string | null;
  const calculate = searchParams.get('calculate') === 'true';

  const periodStart = periodStartParam ? new Date(periodStartParam) : undefined;
  const periodEnd = periodEndParam ? new Date(periodEndParam) : undefined;

  // If calculate=true, generate indicators first
  if (calculate && periodStart && periodEnd) {
    await CDODashboardService.calculateQualityIndicators(
      periodStart,
      periodEnd,
      (careSetting || 'ED') as any
    );
  }

  // Get indicators
  const indicators = await CDORepository.getQualityIndicators(
    indicatorType as any,
    periodStart,
    periodEnd,
    careSetting as any
  );

  return NextResponse.json({
    success: true,
    indicators,
    count: indicators.length,
  });
});

