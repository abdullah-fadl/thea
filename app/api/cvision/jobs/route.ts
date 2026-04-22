import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import * as queue from '@/lib/cvision/jobs/queue';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'queue-stats';

  if (action === 'queue-stats') {
    const data = await queue.getQueueStats(db, tenantId);
    return NextResponse.json({ ok: true, data });
  }

  if (action === 'status') {
    const jobId = searchParams.get('jobId');
    if (!jobId) return NextResponse.json({ ok: false, error: 'jobId required' }, { status: 400 });
    const job = await queue.getJob(db, jobId);
    if (!job) return NextResponse.json({ ok: false, error: 'Job not found' }, { status: 404 });
    return NextResponse.json({ ok: true, data: job });
  }

  if (action === 'list') {
    const queueName = searchParams.get('queue') || 'email';
    const status = searchParams.get('status') as string || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const data = await queue.getJobsByQueue(db, tenantId, queueName, status as any, limit);
    return NextResponse.json({ ok: true, data, total: data.length });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.recruitment.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const action = body.action;

  if (action === 'add') {
    const jobId = await queue.addJob(db, tenantId, body.queue || 'email', body.data || {}, {
      maxAttempts: body.maxAttempts,
    });
    return NextResponse.json({ ok: true, jobId });
  }

  if (action === 'process') {
    const result = await queue.drainQueue(db, body.queue || 'email', body.limit || 10);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'retry') {
    await queue.retryJob(db, body.jobId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'cancel') {
    await queue.cancelJob(db, body.jobId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.recruitment.write' });
