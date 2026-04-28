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
  { params }: { params: Promise<{ policyId: string }> | { policyId: string } }
) {
  return withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const { policyId } = resolvedParams;

      const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);
      const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/policies/${policyId}/text?tenantId=${encodeURIComponent(tenantId)}`;
      const response = await fetch(theaEngineUrl, {
        method: 'GET',
        headers: {
          'x-tenant-id': tenantId,
          'x-org-profile': JSON.stringify(orgProfile),
          'x-context-rules': JSON.stringify(contextRules),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json(
          { error: `Policy engine error: ${errorText}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (error) {
      logger.error('Get policy text error:', { error: error });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.thea-engine.policies.file.read' })(request);
}
