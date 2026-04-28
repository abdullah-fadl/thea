import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';
import { validateBody } from '@/lib/validation/helpers';
import { getOrgContextSnapshot } from '@/lib/sam/contextRules';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

const searchSchema = z.object({
  query: z.string().min(1, 'query is required'),
  topK: z.number().optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId }) => {
  try {
    // Get request body
    const rawBody = await req.json();
    const v = validateBody(rawBody, searchSchema);
    if ('error' in v) return v.error;
    const { query, topK } = v.data;

    const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);

    // Forward to thea-engine with tenantId in body
    const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/search`;
    
    const response = await fetch(theaEngineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({
        tenantId,
        query,
        topK: topK || 10,
        orgProfile,
        contextRules,
      }),
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
    logger.error('Search error:', { error: error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.thea-engine.search' });
