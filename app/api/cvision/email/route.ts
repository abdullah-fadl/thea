import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import * as engine from '@/lib/cvision/email/email-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'queue';

  if (action === 'queue') {
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const data = await engine.getEmailQueue(db, tenantId, status, limit);
    return NextResponse.json({ ok: true, data, total: data.length });
  }

  if (action === 'stats') {
    const data = await engine.getEmailStats(db, tenantId);
    return NextResponse.json({ ok: true, data });
  }

  if (action === 'templates') {
    const data = await engine.listTemplates(db, tenantId);
    return NextResponse.json({ ok: true, data, total: data.length });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
});

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const action = body.action;

  if (action === 'send') {
    const email = await engine.queueEmail(db, tenantId, {
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      templateId: body.templateId,
      templateData: body.templateData,
      subject: body.subject,
      body: body.body,
      priority: body.priority,
    });
    return NextResponse.json({ ok: true, data: email });
  }

  if (action === 'process-queue') {
    const result = await engine.processEmailQueue(db, tenantId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'save-template') {
    const tmpl = await engine.saveTemplate(db, tenantId, body.templateId, {
      subject: body.subject,
      body: body.body,
    });
    return NextResponse.json({ ok: true, data: tmpl });
  }

  if (action === 'preview-template') {
    const builtin = engine.EMAIL_TEMPLATES[body.templateId];
    if (!builtin) return NextResponse.json({ ok: false, error: 'Template not found' }, { status: 404 });
    const rendered = engine.renderTemplate(builtin, body.templateData || {});
    return NextResponse.json({ ok: true, data: rendered });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
});
