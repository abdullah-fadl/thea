import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireTenantId } from '@/lib/tenant';
import { env } from '@/lib/env';
import { withErrorHandler } from '@/lib/core/errors';



export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ policyId: string }> | { policyId: string } }
) => {
  // Authenticate
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  // Handle params - in Next.js 15+ params is a Promise, in earlier versions it's an object
  const resolvedParams = params instanceof Promise ? await params : params;
  const { policyId } = resolvedParams;

  // Get tenantId from session (SINGLE SOURCE OF TRUTH)
  const tenantIdResult = await requireTenantId(request);
  if (tenantIdResult instanceof NextResponse) {
    return tenantIdResult;
  }
  const tenantId = tenantIdResult;

  // Forward to thea-engine with tenantId in query parameter (required by thea-engine)
  const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/policies/${policyId}/file?tenantId=${encodeURIComponent(tenantId)}`;

  const response = await fetch(theaEngineUrl, {
    method: 'GET',
    headers: {
      'x-tenant-id': tenantId, // Also send in header for compatibility
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

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${policyId}.pdf"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=3600',
    },
  });
});
