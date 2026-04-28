import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  logMood, createChallenge, joinChallenge, updateProgress,
  addResource, calculateBurnout, getPrograms, getMyWellness,
  getChallenges, getLeaderboard, getResources, getMoodTrends,
  getBurnoutReport, getStats,
} from '@/lib/cvision/wellness';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ═══════════════════════════════════════════════════════════════════ */
/* GET                                                                */
/* ═══════════════════════════════════════════════════════════════════ */

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }: any) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action') || 'programs';
      const db = await getCVisionDb(tenantId);

      /* ── Programs ─────────────────────────────────────────────────── */
      if (action === 'programs') {
        const result = await getPrograms(db, tenantId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── My Wellness ──────────────────────────────────────────────── */
      if (action === 'my-wellness') {
        const employeeId = searchParams.get('employeeId');
        if (!employeeId) return NextResponse.json({ success: false, error: 'employeeId required' }, { status: 400 });
        const result = await getMyWellness(db, tenantId, employeeId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Challenges ───────────────────────────────────────────────── */
      if (action === 'challenges') {
        const result = await getChallenges(db, tenantId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Leaderboard ──────────────────────────────────────────────── */
      if (action === 'leaderboard') {
        const result = await getLeaderboard(db, tenantId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Resources ────────────────────────────────────────────────── */
      if (action === 'resources') {
        const category = searchParams.get('category') || undefined;
        const result = await getResources(db, tenantId, category);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Mood Trends ──────────────────────────────────────────────── */
      if (action === 'mood-trends') {
        const result = await getMoodTrends(db, tenantId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Burnout Report ───────────────────────────────────────────── */
      if (action === 'burnout-report') {
        const result = await getBurnoutReport(db, tenantId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Stats ────────────────────────────────────────────────────── */
      if (action === 'stats') {
        const result = await getStats(db, tenantId);
        return NextResponse.json({ success: true, ...result });
      }

      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    } catch (err: any) {
      logger.error('[wellness GET]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.employees.read' },
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

      /* ── Log Mood ─────────────────────────────────────────────────── */
      if (action === 'log-mood') {
        const result = await logMood(db, tenantId, body.employeeId, body.mood, body.notes);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Join Challenge ───────────────────────────────────────────── */
      if (action === 'join-challenge') {
        const result = await joinChallenge(db, tenantId, body.challengeId, body.employeeId, body.employeeName);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Update Progress ──────────────────────────────────────────── */
      if (action === 'update-progress') {
        const result = await updateProgress(db, tenantId, body.challengeId, body.employeeId, body.progress);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Create Challenge ─────────────────────────────────────────── */
      if (action === 'create-challenge') {
        const result = await createChallenge(db, tenantId, body);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Add Resource ─────────────────────────────────────────────── */
      if (action === 'add-resource') {
        const result = await addResource(db, tenantId, body);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Calculate Burnout ────────────────────────────────────────── */
      if (action === 'calculate-burnout') {
        const result = await calculateBurnout(db, tenantId, body.employeeId);
        return NextResponse.json({ success: true, ...result });
      }

      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    } catch (err: any) {
      logger.error('[wellness POST]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.employees.write' },
);
