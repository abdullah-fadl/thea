import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';
import { validateBody } from '@/lib/validation/helpers';
import { getOrgContextSnapshot } from '@/lib/sam/contextRules';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

const generateSchema = z.object({
  documentType: z.string().optional(),
  title: z.string().optional(),
  department: z.string().optional(),
  standard: z.string().optional(),
  language: z.enum(['ar', 'en']).optional(),
  tone: z.string().optional(),
  templateId: z.string().optional(),
  prompt: z.string().optional(),
  policyIds: z.array(z.string()).optional(),
  sections: z.array(z.string()).optional(),
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId }) => {
  try {
    // Get request body
    const rawBody = await req.json();
    const v = validateBody(rawBody, generateSchema);
    if ('error' in v) return v.error;
    const body = v.data;

    const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);

    // Forward to thea-engine with tenantId in header
    const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/generate`;

    const response = await fetch(theaEngineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({ ...body, orgProfile, contextRules }),
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
    logger.error('Generate error:', { error: error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.thea-engine.generate' });
