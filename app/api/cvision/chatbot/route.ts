import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { requireCtx } from '@/lib/cvision/authz/enforce';
import { processMessage } from '@/lib/cvision/chatbot/engine';
import { v4 as uuid } from 'uuid';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'history';

  if (action === 'history') {
    const sessions = await db.collection('cvision_chat_history').find({ tenantId, visitorId: ctx.userId }).sort({ createdAt: -1 }).limit(20).toArray();
    return NextResponse.json({ ok: true, data: sessions });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.view' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const action = body.action;

  if (action === 'chat') {
    const { message, sessionId } = body;
    if (!message) return NextResponse.json({ ok: false, error: 'Message required' }, { status: 400 });

    const response = await processMessage(tenantId, ctx.userId, message);
    const sid = sessionId || uuid();
    const userMsg = { role: 'user' as const, content: message, timestamp: new Date() };
    const botMsg = { role: 'assistant' as const, content: response.text, timestamp: new Date(), quickActions: response.quickActions };

    await db.collection('cvision_chat_history').updateOne(
      { tenantId, sessionId: sid },
      { $push: { messages: { $each: [userMsg, botMsg] } }, $setOnInsert: { tenantId, sessionId: sid, visitorId: ctx.userId, createdAt: new Date() }, $set: { updatedAt: new Date() } } as Record<string, unknown>,
      { upsert: true },
    );

    return NextResponse.json({ ok: true, data: { sessionId: sid, response: response.text, quickActions: response.quickActions } });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.view' });
