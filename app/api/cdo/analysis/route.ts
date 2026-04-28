/**
 * CDO Analysis API
 * 
 * Endpoint for running CDO analysis on ER visits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { CDOAnalysisService } from '@/lib/cdo/services/CDOAnalysisService';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const POST = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const body = await request.json();
  const bodySchema = z.object({
    erVisitId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    activeOnly: z.boolean().optional(),
    limit: z.number().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const { erVisitId, startDate, endDate, activeOnly, limit } = body;

  // Run analysis
  const result = await CDOAnalysisService.runAnalysis({
    erVisitId,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    activeOnly,
    limit,
  });

  return NextResponse.json({
    success: true,
    result,
  });
});

/**
 * Get available domains and their availability status
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const domains = CDOAnalysisService.getAvailableDomains();

  return NextResponse.json({
    success: true,
    domains,
  });
});

