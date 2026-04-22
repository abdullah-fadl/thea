/**
 * CDO Outcomes API
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { CDORepository } from '@/lib/cdo/repositories/CDORepository';
import { withErrorHandler } from '@/lib/core/errors';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const erVisitId = searchParams.get('erVisitId');

  if (!erVisitId) {
    return NextResponse.json(
      { error: 'erVisitId is required' },
      { status: 400 }
    );
  }

  const outcomes = await CDORepository.getOutcomeEventsByVisitId(erVisitId);

  return NextResponse.json({
    success: true,
    outcomes,
    count: outcomes.length,
  });
});

