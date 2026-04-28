import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { manualMatchResult } from '@/lib/integrations/lis/service';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

const lisMatchSchema = z.object({
  labResultId: z.string().min(1, 'labResultId is required'),
  patientId: z.string().min(1, 'patientId is required'),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
  const body = await req.json();
  const v = validateBody(body, lisMatchSchema);
  if ('error' in v) return v.error;
  const { labResultId, patientId } = v.data;

  const result = await manualMatchResult(null, tenantId, labResultId, patientId, userId);

  return NextResponse.json({ success: true, result });
}),
  { tenantScoped: true, permissionKey: 'lab.results.edit' });
