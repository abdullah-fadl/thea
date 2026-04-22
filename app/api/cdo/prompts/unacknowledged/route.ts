/**
 * CDO Unacknowledged Prompts API
 * 
 * Get unacknowledged high-risk prompts (for alert fatigue prevention).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { CDOPromptService } from '@/lib/cdo/services/CDOPromptService';
import { withErrorHandler } from '@/lib/core/errors';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const erVisitId = searchParams.get('erVisitId') || undefined;

  const prompts = await CDOPromptService.getUnacknowledgedHighRiskPrompts(erVisitId);

  return NextResponse.json({
    success: true,
    prompts,
    count: prompts.length,
  });
});

