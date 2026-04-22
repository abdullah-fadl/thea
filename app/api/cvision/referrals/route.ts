import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  createReferral,
  updateReferralStatus,
  payReferralBonus,
  listReferrals,
  getMyReferrals,
  getReferralStats,
} from '@/lib/cvision/careers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(async (request: NextRequest, { tenantId, userId }: any) => {
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  // ── List all referrals ────────────────────────────────────────────────
  if (action === 'list') {
    const status = searchParams.get('status') || undefined;
    const data = await listReferrals(db, tenantId, { status });
    return NextResponse.json({ ok: true, data });
  }

  // ── My referrals ──────────────────────────────────────────────────────
  if (action === 'my-referrals') {
    const data = await getMyReferrals(db, tenantId, userId);
    return NextResponse.json({ ok: true, data });
  }

  // ── Referral stats ────────────────────────────────────────────────────
  if (action === 'stats') {
    const data = await getReferralStats(db, tenantId);
    return NextResponse.json({ ok: true, data });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
});

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }: any) => {
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const { action } = body;

  // ── Create referral ───────────────────────────────────────────────────
  if (action === 'create-referral') {
    const data = await createReferral(db, tenantId, body);
    return NextResponse.json({ ok: true, data });
  }

  // ── Update referral status ────────────────────────────────────────────
  if (action === 'update-status') {
    if (!body.referralId || !body.status) {
      return NextResponse.json({ ok: false, error: 'referralId and status are required' }, { status: 400 });
    }
    const data = await updateReferralStatus(db, tenantId, body.referralId, body.status);
    return NextResponse.json({ ok: true, data });
  }

  // ── Pay referral bonus ────────────────────────────────────────────────
  if (action === 'pay-bonus') {
    if (!body.referralId || body.amount == null) {
      return NextResponse.json({ ok: false, error: 'referralId and amount are required' }, { status: 400 });
    }
    const data = await payReferralBonus(db, tenantId, body.referralId, body.amount);
    return NextResponse.json({ ok: true, data });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
});
