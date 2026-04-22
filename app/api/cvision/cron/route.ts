import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { CRON_JOBS, runJob, shouldRun } from '@/lib/cvision/cron/runner';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';
  const jobParam = searchParams.get('job');

  if (action === 'status') {
    const jobs = [];
    for (const job of CRON_JOBS) {
      const lastLog = await db.collection('cvision_cron_logs').findOne({ tenantId, jobName: job.name }, { sort: { completedAt: -1 } }) as Record<string, unknown> | null;
      jobs.push({ name: job.name, description: job.description, schedule: job.schedule, enabled: job.enabled, lastRun: lastLog?.completedAt || null, lastStatus: lastLog?.status || null, lastDuration: lastLog?.durationMs || null, lastItems: lastLog?.itemsProcessed || null });
    }
    return NextResponse.json({ ok: true, data: jobs });
  }

  if (jobParam === 'all') {
    const results = [];
    for (const job of CRON_JOBS) {
      if (!job.enabled) continue;
      const lastLog = await db.collection('cvision_cron_logs').findOne({ tenantId, jobName: job.name }, { sort: { completedAt: -1 } }) as Record<string, unknown> | null;
      if (shouldRun(job.schedule, lastLog?.completedAt as Date || null)) {
        const result = await runJob(tenantId, job.name);
        results.push({ job: job.name, ...result });
      }
    }
    return NextResponse.json({ ok: true, data: results });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
});

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.CONFIG_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires CONFIG_WRITE');
  const body = await request.json();

  if (body.action === 'run') {
    const result = await runJob(tenantId, body.job);
    return NextResponse.json({ ok: true, data: result });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
});
