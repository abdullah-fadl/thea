/**
 * Conflict Resolution API
 * 
 * Guided resolution flow with archive/delete options
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';
import { validateBody } from '@/lib/validation/helpers';
import type { ResolutionRequest, ResolutionResponse } from '@/lib/models/ConflictAnalysis';
import { getOrgContextSnapshot } from '@/lib/sam/contextRules';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

const conflictResolveSchema = z.object({
  scenarioId: z.string().min(1, 'scenarioId is required'),
  action: z.string().min(1, 'action is required'),
  affectedPolicyIds: z.array(z.string()).min(1, 'At least one affectedPolicyId is required'),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId, userId }) => {
  try {
    const rawBody = await req.json();
    const v = validateBody(rawBody, conflictResolveSchema);
    if ('error' in v) return v.error;
    const body = v.data as unknown as ResolutionRequest;

    const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);

    // Forward to thea-engine for resolution
    const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/conflicts/resolve`;
    
    const response = await fetch(theaEngineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: tenantId,
        userId: userId,
        orgProfile,
        contextRules,
        ...body,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Policy engine error: ${errorText}` },
        { status: response.status }
      );
    }

    const data: ResolutionResponse = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    logger.error('Conflict resolution error:', { error: error });
    return NextResponse.json(
      // [SEC-10]
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.thea-engine.conflicts.resolve' });
