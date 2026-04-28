import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  submitSuggestion, voteSuggestion, commentSuggestion,
  respondSuggestion, listSuggestions, getMySuggestions,
  getTrending, createPoll, votePoll, closePoll,
  listPolls, getStats,
} from '@/lib/cvision/engagement';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ═══════════════════════════════════════════════════════════════════ */
/* GET                                                                */
/* ═══════════════════════════════════════════════════════════════════ */

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId, userId }: any) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action') || 'suggestions';
      const db = await getCVisionDb(tenantId);

      /* ── List Suggestions ─────────────────────────────────────────── */
      if (action === 'suggestions') {
        const status = searchParams.get('status') || undefined;
        const category = searchParams.get('category') || undefined;
        const result = await listSuggestions(db, tenantId, { status, category });
        return NextResponse.json({ success: true, ...result });
      }

      /* ── List Polls ───────────────────────────────────────────────── */
      if (action === 'polls') {
        const status = searchParams.get('status') || undefined;
        const result = await listPolls(db, tenantId, status);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── My Submissions ───────────────────────────────────────────── */
      if (action === 'my-submissions') {
        const result = await getMySuggestions(db, tenantId, userId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Trending ─────────────────────────────────────────────────── */
      if (action === 'trending') {
        const result = await getTrending(db, tenantId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Stats ────────────────────────────────────────────────────── */
      if (action === 'stats') {
        const result = await getStats(db, tenantId);
        return NextResponse.json({ success: true, ...result });
      }

      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    } catch (err: any) {
      logger.error('[engagement GET]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.culture.read' },
);

/* ═══════════════════════════════════════════════════════════════════ */
/* POST                                                               */
/* ═══════════════════════════════════════════════════════════════════ */

export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId }: any) => {
    try {
      const body = await request.json();
      const { action } = body;
      const db = await getCVisionDb(tenantId);

      /* ── Submit Suggestion ────────────────────────────────────────── */
      if (action === 'submit-suggestion') {
        const result = await submitSuggestion(db, tenantId, body);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Vote Suggestion ──────────────────────────────────────────── */
      if (action === 'vote-suggestion') {
        const result = await voteSuggestion(db, tenantId, body.suggestionId, userId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Comment on Suggestion ────────────────────────────────────── */
      if (action === 'comment') {
        const result = await commentSuggestion(db, tenantId, body.suggestionId, body.comment);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Respond to Suggestion ────────────────────────────────────── */
      if (action === 'respond') {
        const result = await respondSuggestion(db, tenantId, body.suggestionId, body.response, body.status, body.respondedBy || userId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Create Poll ──────────────────────────────────────────────── */
      if (action === 'create-poll') {
        const result = await createPoll(db, tenantId, body);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Vote Poll ────────────────────────────────────────────────── */
      if (action === 'vote-poll') {
        const result = await votePoll(db, tenantId, body.pollId, body.optionIndex, userId);
        return NextResponse.json({ success: true, ...result });
      }

      /* ── Close Poll ───────────────────────────────────────────────── */
      if (action === 'close-poll') {
        const result = await closePoll(db, tenantId, body.pollId);
        return NextResponse.json({ success: true, ...result });
      }

      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    } catch (err: any) {
      logger.error('[engagement POST]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.culture.write' },
);
