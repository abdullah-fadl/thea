/**
 * CDO Prompts API
 * 
 * Endpoints for managing ClinicalDecisionPrompts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/requireAuth';
import { CDOPromptService, PromptFilter } from '@/lib/cdo/services/CDOPromptService';
import { validateBody } from '@/lib/validation/helpers';
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
  const domain = searchParams.get('domain') as string | null;
  const severity = searchParams.get('severity') as string | null;
  const status = searchParams.get('status') as string | null;
  const requiresAcknowledgment = searchParams.get('requiresAcknowledgment');
  const limit = searchParams.get('limit');

  const filter: PromptFilter = {
    erVisitId: erVisitId || undefined,
    domain: domain as PromptFilter['domain'],
    severity: severity as PromptFilter['severity'],
    status: status as PromptFilter['status'],
    requiresAcknowledgment: requiresAcknowledgment ? requiresAcknowledgment === 'true' : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
  };

  const prompts = await CDOPromptService.getPrompts(filter);

  return NextResponse.json({
    success: true,
    prompts,
    count: prompts.length,
  });
});

/**
 * Get unacknowledged high-risk prompts
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const body = await request.json();
  const bodySchema = z.object({
    action: z.string().min(1),
    promptId: z.string().optional(),
    acknowledgedBy: z.string().optional(),
    acknowledgmentNotes: z.string().optional(),
    resolvedBy: z.string().optional(),
    dismissedBy: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const { action, promptId, acknowledgedBy, acknowledgmentNotes, resolvedBy, dismissedBy } = body;

  if (action === 'acknowledge') {
    if (!promptId || !acknowledgedBy) {
      return NextResponse.json(
        { error: 'promptId and acknowledgedBy are required for acknowledge action' },
        { status: 400 }
      );
    }

    await CDOPromptService.acknowledgePrompt({
      promptId,
      acknowledgedBy,
      acknowledgmentNotes,
    });

    return NextResponse.json({
      success: true,
      message: 'Prompt acknowledged',
    });
  } else if (action === 'resolve') {
    if (!promptId || !resolvedBy) {
      return NextResponse.json(
        { error: 'promptId and resolvedBy are required for resolve action' },
        { status: 400 }
      );
    }

    await CDOPromptService.resolvePrompt(promptId, resolvedBy);

    return NextResponse.json({
      success: true,
      message: 'Prompt resolved',
    });
  } else if (action === 'dismiss') {
    if (!promptId || !dismissedBy) {
      return NextResponse.json(
        { error: 'promptId and dismissedBy are required for dismiss action' },
        { status: 400 }
      );
    }

    await CDOPromptService.dismissPrompt(promptId, dismissedBy);

    return NextResponse.json({
      success: true,
      message: 'Prompt dismissed',
    });
  } else {
    return NextResponse.json(
      { error: 'Invalid action. Use: acknowledge, resolve, or dismiss' },
      { status: 400 }
    );
  }
});

