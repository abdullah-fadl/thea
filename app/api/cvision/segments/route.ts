import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  createSegment, updateRules, addTag, removeTag, bulkTag,
  recalculateSegment, getSegmentEmployees, listSegments,
  getAvailableTags, getTagCloud, getStats,
} from '@/lib/cvision/segments';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ═══════════════════════════════════════════════════════════════════ */
/* GET                                                                */
/* ═══════════════════════════════════════════════════════════════════ */

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }: any) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action') || 'list';
      const db = await getCVisionDb(tenantId);

      /* ── List segments ────────────────────────────────────────────── */
      if (action === 'list') {
        const result = await listSegments(db, tenantId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Segment detail ───────────────────────────────────────────── */
      if (action === 'detail') {
        const segmentId = searchParams.get('segmentId');
        if (!segmentId) return NextResponse.json({ success: false, error: 'segmentId required' }, { status: 400 });
        const segment = await db.collection('cvision_segments').findOne({ tenantId, segmentId });
        if (!segment) return NextResponse.json({ success: false, error: 'Segment not found' }, { status: 404 });
        return NextResponse.json({ success: true, data: segment });
      }

      /* ── Segment employees ────────────────────────────────────────── */
      if (action === 'segment-employees') {
        const segmentId = searchParams.get('segmentId');
        if (!segmentId) return NextResponse.json({ success: false, error: 'segmentId required' }, { status: 400 });
        const result = await getSegmentEmployees(db, tenantId, segmentId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Available tags ───────────────────────────────────────────── */
      if (action === 'available-tags') {
        const result = await getAvailableTags(db, tenantId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Tag cloud ────────────────────────────────────────────────── */
      if (action === 'tag-cloud') {
        const result = await getTagCloud(db, tenantId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Stats ────────────────────────────────────────────────────── */
      if (action === 'stats') {
        const result = await getStats(db, tenantId);
        return NextResponse.json({ success: true, ...result });
      }

      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    } catch (err: any) {
      logger.error('[segments GET]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.dashboards.read' },
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

      /* ── Create segment ───────────────────────────────────────────── */
      if (action === 'create-segment') {
        const result = await createSegment(db, tenantId, body);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Update rules ─────────────────────────────────────────────── */
      if (action === 'update-rules') {
        const result = await updateRules(db, tenantId, body.segmentId, body.rules, body.ruleLogic);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Add tag ──────────────────────────────────────────────────── */
      if (action === 'add-tag') {
        const result = await addTag(db, tenantId, body.employeeId, body.tag);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Remove tag ───────────────────────────────────────────────── */
      if (action === 'remove-tag') {
        const result = await removeTag(db, tenantId, body.employeeId, body.tag);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Bulk tag ─────────────────────────────────────────────────── */
      if (action === 'bulk-tag') {
        const result = await bulkTag(db, tenantId, body.employeeIds, body.tag);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Recalculate segment ──────────────────────────────────────── */
      if (action === 'recalculate-segment') {
        const result = await recalculateSegment(db, tenantId, body.segmentId);
        return NextResponse.json({ success: true, ...result });
      }

      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    } catch (err: any) {
      logger.error('[segments POST]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.dashboards.write' },
);
