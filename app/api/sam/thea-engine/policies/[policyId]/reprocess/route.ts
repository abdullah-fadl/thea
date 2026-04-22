import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';
import { validateBody } from '@/lib/validation/helpers';
import { getOrgContextSnapshot } from '@/lib/sam/contextRules';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

const reprocessSchema = z.object({
  mode: z.enum(['ocr_only', 'full']).optional().default('ocr_only'),
}).passthrough();

export const dynamic = 'force-dynamic';

export async function POST(
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
      const rawBody = await req.json();
      const v = validateBody(rawBody, reprocessSchema);
      if ('error' in v) return v.error;
      const mode = v.data.mode;

    const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);

    // Forward to thea-engine with tenantId as query parameter
    const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/policies/${policyId}/reprocess?tenantId=${encodeURIComponent(tenantId)}`;

    const response = await fetch(theaEngineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode, orgProfile, contextRules }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      return NextResponse.json(
        errorData,
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    logger.error('Reprocess document error:', { error: error });
    // [SEC-06]
    return NextResponse.json(
      { error: 'Failed to reprocess document' },
      { status: 500 }
    );
    }
  }),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'policies.edit' })(request);
}
