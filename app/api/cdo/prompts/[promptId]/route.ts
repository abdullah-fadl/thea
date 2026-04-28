/**
 * CDO Prompt by ID API
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { CDOPromptService } from '@/lib/cdo/services/CDOPromptService';
import { withErrorHandler } from '@/lib/core/errors';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { promptId: string } }
) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const prompt = await CDOPromptService.getPromptById(params.promptId);

  if (!prompt) {
    return NextResponse.json(
      { error: 'Prompt not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    prompt,
  });
});

