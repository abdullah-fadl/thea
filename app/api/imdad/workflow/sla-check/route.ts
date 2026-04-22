import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { getTraceId, withTraceId } from '@/lib/imdad/logger';
import { runSLAWorker } from '@/lib/imdad/sla-worker';

export const dynamic = 'force-dynamic';

export const POST = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const traceId = getTraceId(request);
      const result = await runSLAWorker(tenantId, traceId);
      return withTraceId(NextResponse.json(result), traceId);
    } catch (err: any) {
      return NextResponse.json({ error: 'INTERNAL_ERROR', message: err?.message }, { status: 500 });
    }
  },
  { platformKey: 'imdad' as any, permissionKey: 'imdad.workflow.manage' },
);
