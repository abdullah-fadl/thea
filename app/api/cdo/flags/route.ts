/**
 * CDO Risk Flags API
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
  const activeOnly = searchParams.get('activeOnly') === 'true';

  let flags;
  if (erVisitId) {
    if (activeOnly) {
      flags = await CDORepository.getActiveRiskFlags(erVisitId);
    } else {
      flags = await CDORepository.getRiskFlagsByVisitId(erVisitId);
    }
  } else {
    flags = await CDORepository.getActiveRiskFlags();
  }

  return NextResponse.json({
    success: true,
    flags,
    count: flags.length,
  });
});

