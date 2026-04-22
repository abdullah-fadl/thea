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
  { params }: { params: Promise<{ analysisId: string }> | { analysisId: string } }
) {
  return withAuthTenant(
  withErrorHandler(async (req, { user, tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const { analysisId } = resolvedParams;

      const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);
      const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/conflicts/analyze/${analysisId}/progress`;
      
      const response = await fetch(theaEngineUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-org-profile': JSON.stringify(orgProfile),
          'x-context-rules': JSON.stringify(contextRules),
        },
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: 'Failed to get analysis progress' },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (error) {
      logger.error('Get analysis progress error:', { error: error });
      return NextResponse.json(
        // [SEC-10]
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.thea-engine.conflicts' })(request);
}
