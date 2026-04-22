import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import * as sessions from '@/lib/cvision/security/session-manager';
import * as twoFA from '@/lib/cvision/security/two-factor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'my-sessions';

  if (action === 'my-sessions') {
    const data = await sessions.getActiveSessions(db, tenantId, userId || '');
    return NextResponse.json({ ok: true, data, total: data.length });
  }

  if (action === 'login-history') {
    const limit = parseInt(searchParams.get('limit') || '20');
    const data = await sessions.getLoginHistory(db, tenantId, userId || '', limit);
    return NextResponse.json({ ok: true, data, total: data.length });
  }

  if (action === '2fa-status') {
    const data = await twoFA.get2FAStatus(db, userId || '');
    return NextResponse.json({ ok: true, data });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.view' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const action = body.action;

  if (action === 'revoke-session') {
    await sessions.revokeSession(db, tenantId, userId || '', body.sessionId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'revoke-all') {
    const currentToken = body.exceptCurrentToken;
    await sessions.revokeAllSessions(db, tenantId, userId || '', currentToken);
    return NextResponse.json({ ok: true });
  }

  if (action === 'report-suspicious') {
    const result = await sessions.reportSuspiciousLogin(db, tenantId, userId || '', body.loginId);
    return NextResponse.json({ ok: true, ...result });
  }

  // 2FA actions
  if (action === 'setup-2fa') {
    const data = await twoFA.setup2FA(db, userId || '', body.email || '');
    return NextResponse.json({ ok: true, data });
  }

  if (action === 'confirm-2fa') {
    const success = await twoFA.confirm2FA(db, userId || '', body.token);
    if (!success) return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'verify-2fa') {
    const success = await twoFA.verify2FAToken(db, userId || '', body.token);
    if (!success) return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'disable-2fa') {
    await twoFA.disable2FA(db, userId || '');
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.view' });
