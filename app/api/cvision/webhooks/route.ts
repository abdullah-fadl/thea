import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { dispatchWebhook } from '@/lib/cvision/webhook';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

const AVAILABLE_EVENTS = [
  'employee.created', 'employee.updated', 'employee.terminated',
  'leave.requested', 'leave.approved', 'leave.rejected',
  'loan.approved', 'contract.created', 'contract.expiring',
  'payroll.processed', 'training.completed', 'letter.generated',
  'onboarding.started', 'offboarding.started',
];

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.INTEGRATIONS_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires INTEGRATIONS_READ');
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    const subs = await db.collection('cvision_webhook_subscriptions').find({ tenantId }).limit(100).toArray();
    return NextResponse.json({ ok: true, data: subs, availableEvents: AVAILABLE_EVENTS });
  }

  if (action === 'deliveries') {
    const webhookId = searchParams.get('webhookId');
    const deliveries = await db.collection('cvision_webhook_deliveries').find({ tenantId, webhookId }).sort({ createdAt: -1 }).limit(50).toArray();
    return NextResponse.json({ ok: true, data: deliveries });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.webhooks.manage' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.INTEGRATIONS_MANAGE)) return deny('INSUFFICIENT_PERMISSION', 'Requires INTEGRATIONS_MANAGE');
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const action = body.action;

  if (action === 'create') {
    const secret = crypto.randomBytes(32).toString('hex');
    const doc = {
      tenantId, webhookId: uuid(), name: body.name, url: body.url, secret,
      events: body.events || [], isActive: true, headers: body.headers || {},
      retryCount: 3, createdBy: ctx.userId, createdAt: new Date(), updatedAt: new Date(),
    };
    await db.collection('cvision_webhook_subscriptions').insertOne(doc);
    return NextResponse.json({ ok: true, data: { ...doc, secret } });
  }

  if (action === 'update') {
    const update: any = { updatedAt: new Date() };
    if (body.name) update.name = body.name;
    if (body.url) update.url = body.url;
    if (body.events) update.events = body.events;
    if (body.isActive !== undefined) update.isActive = body.isActive;
    if (body.headers) update.headers = body.headers;
    await db.collection('cvision_webhook_subscriptions').updateOne({ tenantId, webhookId: body.webhookId }, { $set: update });
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete') {
    await db.collection('cvision_webhook_subscriptions').deleteOne({ tenantId, webhookId: body.webhookId });
    return NextResponse.json({ ok: true });
  }

  if (action === 'test') {
    await dispatchWebhook(tenantId, 'test.ping', { message: 'This is a test event from CVision HR', timestamp: new Date().toISOString() });
    return NextResponse.json({ ok: true, message: 'Test event dispatched' });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.webhooks.manage' });
