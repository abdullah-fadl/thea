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
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(
  withErrorHandler(async (req, { user, tenantId }) => {
    try {
      // Handle params - in Next.js 15+ params is a Promise, in earlier versions it's an object
      const resolvedParams = params instanceof Promise ? await params : params;
      const { policyId } = resolvedParams;

    const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);

    // Forward to thea-engine with tenantId in query parameter (required by thea-engine)
    const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/policies/${policyId}/file?tenantId=${encodeURIComponent(tenantId)}`;
    
    const response = await fetch(theaEngineUrl, {
      method: 'GET',
      headers: {
        'x-tenant-id': tenantId, // Also send in header for compatibility
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

    // Stream the file back
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const disposition = response.headers.get('content-disposition');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition || `inline; filename="${policyId}"`,
      },
    });

  } catch (error) {
    logger.error('Get policy file error:', { error: error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.thea-engine.policies.file.read' })(request);
}
