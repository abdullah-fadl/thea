import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  searchEmployees, getByDepartment, getOrgTree, getWhosOut,
  getBirthdays, getAnniversaries, getNewJoiners, getFloorMap, getStats,
} from '@/lib/cvision/directory';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ═══════════════════════════════════════════════════════════════════ */
/* GET                                                                */
/* ═══════════════════════════════════════════════════════════════════ */

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action') || 'search';
      const db = await getCVisionDb(tenantId);

      /* ── Search employees ────────────────────────────────────────── */
      if (action === 'search') {
        const query = searchParams.get('q') || '';
        const departmentId = searchParams.get('departmentId') || undefined;
        const status = searchParams.get('status') || undefined;
        const items = await searchEmployees(db, tenantId, query, { departmentId, status });
        return NextResponse.json({ success: true, data: { items, total: items.length } });
      }

      /* ── By department ───────────────────────────────────────────── */
      if (action === 'by-department') {
        const groups = await getByDepartment(db, tenantId);
        return NextResponse.json({ success: true, data: groups });
      }

      /* ── Org tree ────────────────────────────────────────────────── */
      if (action === 'org-tree') {
        const tree = await getOrgTree(db, tenantId);
        return NextResponse.json({ success: true, data: tree });
      }

      /* ── Who's out ───────────────────────────────────────────────── */
      if (action === 'whos-out') {
        const result = await getWhosOut(db, tenantId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Birthdays ───────────────────────────────────────────────── */
      if (action === 'birthdays') {
        const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;
        const items = await getBirthdays(db, tenantId, month);
        return NextResponse.json({ success: true, data: { items, total: items.length } });
      }

      /* ── Anniversaries ───────────────────────────────────────────── */
      if (action === 'anniversaries') {
        const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;
        const items = await getAnniversaries(db, tenantId, month);
        return NextResponse.json({ success: true, data: { items, total: items.length } });
      }

      /* ── New joiners ─────────────────────────────────────────────── */
      if (action === 'new-joiners') {
        const days = searchParams.get('days') ? parseInt(searchParams.get('days')!) : 30;
        const items = await getNewJoiners(db, tenantId, days);
        return NextResponse.json({ success: true, data: { items, total: items.length } });
      }

      /* ── Floor map ───────────────────────────────────────────────── */
      if (action === 'floor-map') {
        const locations = await getFloorMap(db, tenantId);
        return NextResponse.json({ success: true, data: locations });
      }

      /* ── Stats ───────────────────────────────────────────────────── */
      if (action === 'stats') {
        const result = await getStats(db, tenantId);
        return NextResponse.json({ success: true, ...result });
      }

      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    } catch (err: any) {
      logger.error('[directory GET]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
);
