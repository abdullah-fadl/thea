import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';
import { validateBody } from '@/lib/validation/helpers';
import { getOrgContextSnapshot } from '@/lib/sam/contextRules';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

const rewriteSchema = z.object({
  mode: z.string().optional(),
  issues: z.array(z.any()).optional(),
  language: z.string().optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ policyId: string }> | { policyId: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(
  withErrorHandler(async (req, { user, tenantId }) => {
    try {
      // Resolve params
      const resolvedParams = params instanceof Promise ? await params : params;
      const { policyId } = resolvedParams;

      // Get request body
      const rawBody = await req.json();
      const v = validateBody(rawBody, rewriteSchema);
      if ('error' in v) return v.error;
    const { mode, issues, language } = v.data;

    const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);

    // Forward to thea-engine with tenantId as a query parameter
    const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/policies/${encodeURIComponent(policyId)}/rewrite?tenantId=${encodeURIComponent(tenantId)}`;

    let response;
    try {
      response = await fetch(theaEngineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: mode || 'apply_all',
          issues: issues || [],
          language: language || 'auto',
          orgProfile,
          contextRules,
        }),
      });
    } catch (fetchError) {
      logger.error('Failed to connect to thea-engine:', { error: fetchError });
      return NextResponse.json(
        {
          // [SEC-10]
          error: 'Thea service is not available. Please ensure the service is running on port 8001.',
        },
        { status: 503 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Thea service error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    logger.error('Rewrite policy error:', { error: error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.thea-engine.policies.rewrite' })(request);
}

