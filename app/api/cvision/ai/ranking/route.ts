import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Candidate Ranking & Seriousness API
 *
 * GET  ?action=rank&requisitionId=xxx
 * GET  ?action=candidate-detail&candidateId=xxx&requisitionId=xxx
 * GET  ?action=flags&requisitionId=xxx  (optional)
 * GET  ?action=leaderboard
 *
 * POST action=track-interaction
 * POST action=recalculate
 */

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  rankCandidatesForJob,
  getCandidateRankingDetail,
  getFlaggedCandidates,
  getLeaderboard,
  trackCandidateInteraction,
  type InteractionType,
} from '@/lib/cvision/ai/candidate-ranking-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_INTERACTIONS: InteractionType[] = [
  'EMAIL_RESPONSE',
  'DOCUMENT_SUBMITTED',
  'INTERVIEW_ATTENDED',
  'INTERVIEW_NO_SHOW',
  'FOLLOW_UP_SENT',
  'QUESTION_ASKED',
];

// ─── GET ────────────────────────────────────────────────────────────────────

export const GET = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const url = new URL(request.url);
      const action = url.searchParams.get('action') || 'rank';

      switch (action) {
        case 'rank': {
          const requisitionId = url.searchParams.get('requisitionId');
          if (!requisitionId) {
            return NextResponse.json({ error: 'requisitionId required' }, { status: 400 });
          }
          const rankings = await rankCandidatesForJob(tenantId, requisitionId);
          return NextResponse.json({ data: rankings, total: rankings.length });
        }

        case 'candidate-detail': {
          const candidateId = url.searchParams.get('candidateId');
          const requisitionId = url.searchParams.get('requisitionId');
          if (!candidateId || !requisitionId) {
            return NextResponse.json(
              { error: 'candidateId and requisitionId required' },
              { status: 400 },
            );
          }
          const detail = await getCandidateRankingDetail(tenantId, candidateId, requisitionId);
          if (!detail) {
            return NextResponse.json({ error: 'Ranking not found' }, { status: 404 });
          }
          return NextResponse.json({ data: detail });
        }

        case 'flags': {
          const requisitionId = url.searchParams.get('requisitionId') || undefined;
          const flagged = await getFlaggedCandidates(tenantId, requisitionId);
          return NextResponse.json({ data: flagged, total: flagged.length });
        }

        case 'leaderboard': {
          const leaders = await getLeaderboard(tenantId);
          return NextResponse.json({ data: leaders, total: leaders.length });
        }

        default:
          return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
      }
    } catch (err: any) {
      logger.error('[Ranking GET]', err);
      return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.view' },
);

// ─── POST ───────────────────────────────────────────────────────────────────

export const POST = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const body = await request.json();
      const { action } = body;

      switch (action) {
        case 'track-interaction': {
          const { candidateId, interactionType, timestamp, metadata } = body;
          if (!candidateId || !interactionType) {
            return NextResponse.json(
              { error: 'candidateId and interactionType required' },
              { status: 400 },
            );
          }
          if (!VALID_INTERACTIONS.includes(interactionType)) {
            return NextResponse.json(
              { error: `Invalid interactionType. Valid: ${VALID_INTERACTIONS.join(', ')}` },
              { status: 400 },
            );
          }
          const interaction = await trackCandidateInteraction(
            tenantId,
            candidateId,
            interactionType,
            timestamp ? new Date(timestamp) : undefined,
            metadata,
          );
          return NextResponse.json({ data: interaction });
        }

        case 'recalculate': {
          const { requisitionId } = body;
          if (!requisitionId) {
            return NextResponse.json({ error: 'requisitionId required' }, { status: 400 });
          }
          const rankings = await rankCandidatesForJob(tenantId, requisitionId);
          return NextResponse.json({ data: rankings, total: rankings.length });
        }

        default:
          return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
      }
    } catch (err: any) {
      logger.error('[Ranking POST]', err);
      return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.view' },
);
