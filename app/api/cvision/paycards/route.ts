import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  issueCard, loadFunds, blockCard, unblockCard, cancelCard, replaceCard, bulkLoad,
  listCards, getEmployeeCard, getLoadHistory, getStats,
} from '@/lib/cvision/paycards';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ═══════════════════════════════════════════════════════════════════ */
/* GET                                                                */
/* ═══════════════════════════════════════════════════════════════════ */

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action') || 'list';
      const db = await getCVisionDb(tenantId);

      /* ── List cards ──────────────────────────────────────────────── */
      if (action === 'list') {
        const status = searchParams.get('status') || undefined;
        const provider = searchParams.get('provider') || undefined;
        const items = await listCards(db, tenantId, { status, provider });
        return NextResponse.json({ success: true, data: { items, total: items.length } });
      }

      /* ── Employee card ───────────────────────────────────────────── */
      if (action === 'employee-card') {
        const employeeId = searchParams.get('employeeId');
        if (!employeeId) return NextResponse.json({ success: false, error: 'employeeId required' }, { status: 400 });
        const card = await getEmployeeCard(db, tenantId, employeeId);
        return NextResponse.json({ success: true, data: card });
      }

      /* ── Load history ────────────────────────────────────────────── */
      if (action === 'load-history') {
        const cardId = searchParams.get('cardId');
        if (!cardId) return NextResponse.json({ success: false, error: 'cardId required' }, { status: 400 });
        const items = await getLoadHistory(db, tenantId, cardId);
        return NextResponse.json({ success: true, data: { items, total: items.length } });
      }

      /* ── Stats ───────────────────────────────────────────────────── */
      if (action === 'stats') {
        const result = await getStats(db, tenantId);
        return NextResponse.json({ success: true, ...result });
      }

      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    } catch (err: any) {
      logger.error('[paycards GET]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.payroll.read' },
);

/* ═══════════════════════════════════════════════════════════════════ */
/* POST                                                               */
/* ═══════════════════════════════════════════════════════════════════ */

export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId }: any) => {
    try {
      const body = await request.json();
      const { action } = body;
      const db = await getCVisionDb(tenantId);

      /* ── Issue card ──────────────────────────────────────────────── */
      if (action === 'issue') {
        const result = await issueCard(db, tenantId, body);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Load funds ──────────────────────────────────────────────── */
      if (action === 'load-funds') {
        const result = await loadFunds(db, tenantId, body.cardId, body.amount, body.source, body.reference, body.payrollMonth);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Block card ──────────────────────────────────────────────── */
      if (action === 'block') {
        const result = await blockCard(db, tenantId, body.cardId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Unblock card ────────────────────────────────────────────── */
      if (action === 'unblock') {
        const result = await unblockCard(db, tenantId, body.cardId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Cancel card ─────────────────────────────────────────────── */
      if (action === 'cancel') {
        const result = await cancelCard(db, tenantId, body.cardId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Replace card ────────────────────────────────────────────── */
      if (action === 'replace') {
        const result = await replaceCard(db, tenantId, body.cardId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Bulk load ───────────────────────────────────────────────── */
      if (action === 'bulk-load') {
        const result = await bulkLoad(db, tenantId, body.loads, body.payrollMonth);
        return NextResponse.json({ success: true, ...result });
      }

      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    } catch (err: any) {
      logger.error('[paycards POST]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.payroll.write' },
);
