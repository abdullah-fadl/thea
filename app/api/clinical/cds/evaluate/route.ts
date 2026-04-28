import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { evaluateCds } from '@/lib/clinical/cdsRules';

const cdsEvaluateSchema = z.object({}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest) => {
  const rawBody = await req.json().catch(() => ({}));
  const v = validateBody(rawBody, cdsEvaluateSchema);
  if ('error' in v) return v.error;
  const alerts = evaluateCds(v.data || {});
  return NextResponse.json({ alerts });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.view' }
);
