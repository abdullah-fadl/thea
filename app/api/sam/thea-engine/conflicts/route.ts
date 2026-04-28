import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { env } from '@/lib/env';
import { validateBody } from '@/lib/validation/helpers';
import { buildOrgProfileRequiredResponse, requireTenantContext, OrgProfileRequiredError } from '@/lib/tenant/getTenantContext';
import { getOrgContextSnapshot } from '@/lib/sam/contextRules';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

const conflictsSchema = z.object({
  mode: z.string().optional(),
  policyIdA: z.string().optional(),
  policyIdB: z.string().optional(),
  strictness: z.string().optional(),
  category: z.string().optional(),
  limitPolicies: z.number().optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId }) => {
  try {
    // Get request body
    const rawBody = await req.json();
    const v = validateBody(rawBody, conflictsSchema);
    if ('error' in v) return v.error;
    const body = v.data;
    const { mode, policyIdA, policyIdB, strictness, category, limitPolicies } = body;

    let tenantContext: any = null;
    try {
      tenantContext = await requireTenantContext(req, tenantId);
    } catch (error) {
      if (error instanceof OrgProfileRequiredError) {
        return buildOrgProfileRequiredResponse();
      }
    }

    const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId);

    // Forward to thea-engine with tenantId in request body
    const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/conflicts`;
    
    const response = await fetch(theaEngineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: tenantId,
        tenantContext,
        orgProfile,
        contextRules,
        mode,
        policyIdA: policyIdA || undefined,
        policyIdB: policyIdB || undefined,
        strictness: strictness || 'strict',
        category: category || undefined,
        limitPolicies: limitPolicies || undefined,
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
    logger.error('Conflicts error:', { error: error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.thea-engine.conflicts' });
