import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { seedDemoData, clearAllData, seedStatus } from '@/lib/cvision/seed/generate';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Roles that are permitted to wipe all seed/demo data
const SUPER_ADMIN_ROLES = ['thea-owner', 'owner', 'super-admin'];

function isSuperAdmin(role: string): boolean {
  return SUPER_ADMIN_ROLES.includes(role);
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'seed-status';

  if (action === 'seed-status') {
    const data = await seedStatus(db, tenantId);
    return NextResponse.json({ ok: true, ...data });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
});

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, role }) => {
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const action = body.action;

  if (action === 'generate-demo') {
    const existing = await seedStatus(db, tenantId);
    if (existing.hasData && !body.force) {
      return NextResponse.json({
        ok: false,
        error: 'Data already exists. Use force: true to overwrite, or clear-all first.',
        counts: existing.counts,
      }, { status: 409 });
    }

    if (existing.hasData && body.force) {
      await clearAllData(db, tenantId);
    }

    const result = await seedDemoData(db, tenantId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'clear-all') {
    // Permission check — only super-admin / owner roles may clear all data
    if (!isSuperAdmin(role)) {
      return NextResponse.json({
        ok: false,
        error: 'Forbidden: only a super-admin or owner may clear all data.',
      }, { status: 403 });
    }

    // Require an explicit confirmation token to prevent accidental calls
    if (body.confirm !== 'DELETE_ALL_DATA') {
      return NextResponse.json({
        ok: false,
        error: 'Safety check failed: set confirm to the string "DELETE_ALL_DATA" to proceed.',
      }, { status: 400 });
    }

    const result = await clearAllData(db, tenantId);
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
});
