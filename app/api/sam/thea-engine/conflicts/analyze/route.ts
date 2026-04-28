/**
 * Multi-layer Conflict Analysis API
 * 
 * Operational Integrity & Decision Engine endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';
import { validateBody } from '@/lib/validation/helpers';
import type { ConflictAnalysisRequest, ConflictAnalysisResponse } from '@/lib/models/ConflictAnalysis';
import { buildOrgProfileRequiredResponse, requireTenantContext, OrgProfileRequiredError } from '@/lib/tenant/getTenantContext';
import { getOrgContextSnapshot } from '@/lib/sam/contextRules';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

const conflictAnalyzeSchema = z.object({
  scope: z.record(z.string(), z.unknown()),
  layers: z.array(z.any()).min(1, 'At least one layer is required'),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId }) => {
  try {
    const rawBody = await req.json();
    const v = validateBody(rawBody, conflictAnalyzeSchema);
    if ('error' in v) return v.error;
    const body = v.data as unknown as ConflictAnalysisRequest;

    let tenantContext: any = null;
    try {
      tenantContext = await requireTenantContext(req, tenantId);
    } catch (error) {
      if (error instanceof OrgProfileRequiredError) {
        return buildOrgProfileRequiredResponse();
      }
    }

    const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);

    // Forward to thea-engine with enhanced analysis
    const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/conflicts/analyze`;
    
    const response = await fetch(theaEngineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: tenantId,
        tenantContext,
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

    const data: ConflictAnalysisResponse = await response.json();
    
    // Include analysisId in response if available (thea-engine may include it)
    const analysisId = (data as any)?.metadata?.analysisId;
    if (analysisId) {
      return NextResponse.json({ ...data, analysisId });
    }
    
    return NextResponse.json(data);

  } catch (error) {
    logger.error('Conflict analysis error:', { error: error });
    return NextResponse.json(
      // [SEC-10]
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.thea-engine.conflicts' });
