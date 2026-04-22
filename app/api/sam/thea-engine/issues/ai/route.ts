import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';
import { validateBody } from '@/lib/validation/helpers';
import { getOrgContextSnapshot } from '@/lib/sam/contextRules';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

const issuesAiSchema = z.object({
  query: z.string(),
  policyIds: z.array(z.string()).nullable().optional(),
  topK: z.number().int().min(1).max(100).optional(),
  includeEvidence: z.boolean().optional(),
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId }) => {
  try {
    // Parse request body
    const rawBody = await req.json();
    const v = validateBody(rawBody, issuesAiSchema);
    if ('error' in v) return v.error;
    const body = v.data;

    const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);

    // Forward to thea-engine with tenantId as a query parameter
    const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/issues/ai?tenantId=${encodeURIComponent(tenantId)}`;
    
    let response;
    try {
      response = await fetch(theaEngineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...body, orgProfile, contextRules }),
      });
    } catch (fetchError) {
      logger.error('Failed to connect to thea-engine:', { error: fetchError });
      return NextResponse.json(
        { 
          error: 'Document engine service is not available. Automated features are disabled.',
          serviceUnavailable: true,
          issues: [],
        },
        { status: 200 }
      );
    }

    // Get response body as text first to handle both JSON and errors
    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { error: responseText };
    }

    // Return with same status code and body (transparent proxy)
    return NextResponse.json(responseData, { status: response.status });

  } catch (error) {
    logger.error('AI Issues error:', { error: error });
    // [SEC-10]
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.thea-engine.issues.ai' });

