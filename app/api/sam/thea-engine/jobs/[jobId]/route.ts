import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';
import { getOrgContextSnapshot } from '@/lib/sam/contextRules';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> | { jobId: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(
  withErrorHandler(async (req, { user, tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const { jobId } = resolvedParams;

      const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);

      // Forward to thea-engine with tenantId as a query parameter
      const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/jobs/${jobId}?tenantId=${tenantId}`;
      
      const response = await fetch(theaEngineUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-org-profile': JSON.stringify(orgProfile),
          'x-context-rules': JSON.stringify(contextRules),
        },
      });

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
      logger.error('Get job status error:', { error: error });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }),
  { platformKey: 'sam', tenantScoped: true })(request);
}
