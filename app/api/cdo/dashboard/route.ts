/**
 * CDO Dashboard API
 * 
 * Endpoints for dashboard data and quality indicators.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
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
  const periodStartParam = searchParams.get('periodStart');
  const periodEndParam = searchParams.get('periodEnd');
  const careSetting = (searchParams.get('careSetting') || 'ED') as 'ED' | 'WARD' | 'ICU' | 'ALL';
  const calculateIndicators = searchParams.get('calculateIndicators') === 'true';

  // Default to last 7 days if not specified
  const periodEnd = periodEndParam ? new Date(periodEndParam) : new Date();
  const periodStart = periodStartParam
    ? new Date(periodStartParam)
    : new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

  // Generate dashboard summary
  const summary = await CDODashboardService.generateDashboardSummary(
    periodStart,
    periodEnd,
    careSetting
  );

  // Optionally calculate and save quality indicators
  if (calculateIndicators) {
    await CDODashboardService.calculateQualityIndicators(
      periodStart,
      periodEnd,
      careSetting
    );

    // Re-fetch summary with updated indicators
    const updatedSummary = await CDODashboardService.generateDashboardSummary(
      periodStart,
      periodEnd,
      careSetting
    );
    return NextResponse.json({
      success: true,
      summary: updatedSummary,
    });
  }

  return NextResponse.json({
    success: true,
    summary,
  });
});

