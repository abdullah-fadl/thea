import { logger } from '@/lib/monitoring/logger';
/**
 * CVision AI Interview Chatbot API
 *
 * GET  ?action=sessions            (list, with optional filters)
 * GET  ?action=session-detail      (&sessionId=xxx)
 * GET  ?action=session-results     (&sessionId=xxx)
 * GET  ?action=templates
 *
 * POST action=create-session
 * POST action=submit-answer
 * POST action=complete
 * POST action=send-invite
 * POST action=cancel
 * POST action=bulk-create
 */

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  listSessions,
  getSessionById,
  createInterviewSession,
  submitAnswer,
  completeInterview,
  sendInterviewInvite,
  cancelSession,
  getQuestionTemplates,
  regenerateSessionQuestions,
} from '@/lib/cvision/ai/interview-chatbot-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── GET ────────────────────────────────────────────────────────────────────

export const GET = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const url = new URL(request.url);
      const action = url.searchParams.get('action') || 'sessions';

      switch (action) {
        case 'sessions': {
          const filters = {
            status: url.searchParams.get('status') || undefined,
            requisitionId: url.searchParams.get('requisitionId') || undefined,
            candidateId: url.searchParams.get('candidateId') || undefined,
          };
          const sessions = await listSessions(tenantId, filters);
          return NextResponse.json({ data: sessions, total: sessions.length });
        }

        case 'session-detail': {
          const sessionId = url.searchParams.get('sessionId');
          if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
          const session = await getSessionById(tenantId, sessionId);
          if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
          return NextResponse.json({ data: session });
        }

        case 'session-results': {
          const sessionId = url.searchParams.get('sessionId');
          if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
          const session = await getSessionById(tenantId, sessionId);
          if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
          return NextResponse.json({
            data: {
              sessionId: session.sessionId,
              candidateName: session.candidateName,
              jobTitle: session.jobTitle,
              status: session.status,
              overallScore: session.overallScore,
              recommendation: session.recommendation,
              summary: session.summary,
              strengths: session.strengths,
              concerns: session.concerns,
              answers: session.answers,
              questions: session.questions,
              startedAt: session.startedAt,
              completedAt: session.completedAt,
            },
          });
        }

        case 'templates': {
          return NextResponse.json({ data: getQuestionTemplates() });
        }

        default:
          return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
      }
    } catch (err: any) {
      logger.error('[Chatbot GET]', err);
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
        case 'create-session': {
          const { candidateId, requisitionId, language, questionCount, jobTitle } = body;
          if (!candidateId) {
            return NextResponse.json({ error: 'candidateId is required' }, { status: 400 });
          }
          if (!requisitionId && !jobTitle) {
            return NextResponse.json({ error: 'Either requisitionId or jobTitle is required' }, { status: 400 });
          }
          const result = await createInterviewSession(
            tenantId, candidateId, requisitionId || null,
            language || 'en', questionCount || 8,
            jobTitle,
          );
          return NextResponse.json({ data: result });
        }

        case 'submit-answer': {
          const { sessionId, questionId, answer, timeSpent } = body;
          if (!sessionId || !questionId || answer === undefined) {
            return NextResponse.json({ error: 'sessionId, questionId, and answer required' }, { status: 400 });
          }
          const result = await submitAnswer(tenantId, sessionId, questionId, answer, timeSpent || 0);
          return NextResponse.json({ data: result });
        }

        case 'complete': {
          const { sessionId } = body;
          if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
          const result = await completeInterview(tenantId, sessionId);
          return NextResponse.json({ data: result });
        }

        case 'send-invite': {
          const { sessionId, email } = body;
          if (!sessionId || !email) {
            return NextResponse.json({ error: 'sessionId and email required' }, { status: 400 });
          }
          const result = await sendInterviewInvite(tenantId, sessionId, email);
          return NextResponse.json({ data: result });
        }

        case 'cancel': {
          const { sessionId } = body;
          if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
          await cancelSession(tenantId, sessionId);
          return NextResponse.json({ data: { success: true } });
        }

        case 'regenerate-questions': {
          const { sessionId, questionCount } = body;
          if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
          const result = await regenerateSessionQuestions(tenantId, sessionId, questionCount);
          return NextResponse.json({ data: result });
        }

        case 'bulk-create': {
          const { requisitionId, candidateIds, language, questionCount } = body;
          if (!requisitionId || !candidateIds?.length) {
            return NextResponse.json({ error: 'requisitionId and candidateIds[] required' }, { status: 400 });
          }
          const results: any[] = [];
          for (const cid of candidateIds.slice(0, 50)) {
            try {
              const r = await createInterviewSession(
                tenantId, cid, requisitionId,
                language || 'en', questionCount || 8,
              );
              results.push({ candidateId: cid, sessionId: r.session.id, inviteLink: r.inviteLink });
            } catch (err: any) {
              results.push({ candidateId: cid, error: err.message });
            }
          }
          return NextResponse.json({ data: results, total: results.length });
        }

        default:
          return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
      }
    } catch (err: any) {
      logger.error('[Chatbot POST]', err);
      return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.view' },
);
