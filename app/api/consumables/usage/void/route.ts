import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { voidConsumableUsage } from '@/lib/consumables/usageRecording';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const voidSchema = z.object({
  usageEventId: z.string().min(1),
  reason: z.string().min(1),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();
    const v = validateBody(body, voidSchema);
    if ('error' in v) return v.error;

    try {
      const result = await voidConsumableUsage({
        tenantId,
        usageEventId: body.usageEventId,
        reason: body.reason,
        userId,
      });
      return NextResponse.json({ ok: true, ...result });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Void failed' }, { status: 400 });
    }
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
