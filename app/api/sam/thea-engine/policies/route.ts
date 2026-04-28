import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';
import { getOrgContextSnapshot } from '@/lib/sam/contextRules';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId }) => {
  try {

    const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);

    // Forward to thea-engine with tenantId as query parameter
    const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/policies?tenantId=${encodeURIComponent(tenantId)}`;
    
    let response;
    try {
      response = await fetch(theaEngineUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-org-profile': JSON.stringify(orgProfile),
          'x-context-rules': JSON.stringify(contextRules),
        },
      });
    } catch (fetchError) {
      logger.error('Failed to connect to thea-engine:', { error: fetchError });
      // Return empty policies list with serviceUnavailable flag
      // This allows the UI to show a message instead of error toast
      return NextResponse.json(
        { 
          policies: [],
          serviceUnavailable: true,
          message: 'Document engine service is not available. Document features are currently disabled.',
        },
        { status: 200 }
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
    logger.error('List policies error:', { error: error });
    // [SEC-10]
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'policies.view' });
