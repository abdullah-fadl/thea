import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Interview Management API
 * GET  /api/cvision/recruitment/interviews?action=...
 * POST /api/cvision/recruitment/interviews  { action, ... }
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionCollection, findById, createTenantFilter } from '@/lib/cvision/db';
import { logCVisionAudit, createCVisionAuditContext } from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_SCORE_CATEGORIES = [
  { id: 'technical', label: 'Technical Skills', labelAr: 'المهارات التقنية' },
  { id: 'communication', label: 'Communication', labelAr: 'التواصل' },
  { id: 'problem_solving', label: 'Problem Solving', labelAr: 'حل المشكلات' },
  { id: 'culture_fit', label: 'Culture Fit', labelAr: 'التوافق الثقافي' },
  { id: 'experience', label: 'Relevant Experience', labelAr: 'الخبرة المرتبطة' },
  { id: 'motivation', label: 'Motivation & Interest', labelAr: 'الدافع والاهتمام' },
];

const RECOMMENDATION_LABELS: Record<string, { label: string; color: string }> = {
  STRONG_HIRE: { label: 'Strong Hire', color: 'green' },
  HIRE: { label: 'Hire', color: 'emerald' },
  MAYBE: { label: 'Maybe', color: 'yellow' },
  NO_HIRE: { label: 'No Hire', color: 'orange' },
  STRONG_NO_HIRE: { label: 'Strong No', color: 'red' },
};

// ── GET ────────────────────────────────────────────────────────────

export const GET = withAuthTenant(
  async (request, { tenantId, userId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action') || 'list';
      const col = await getCVisionCollection(tenantId, 'interviews');

      if (action === 'score-categories') {
        return NextResponse.json({ success: true, categories: DEFAULT_SCORE_CATEGORIES, recommendations: RECOMMENDATION_LABELS });
      }

      if (action === 'list') {
        const candidateId = searchParams.get('candidateId');
        const jobId = searchParams.get('jobId');
        const status = searchParams.get('status');
        const filter: any = createTenantFilter(tenantId);
        if (candidateId) filter.candidateId = candidateId;
        if (jobId) filter.jobId = jobId;
        if (status) filter.status = status;

        const interviews = await col.find(filter).sort({ scheduledDate: -1 }).limit(200).toArray();
        return NextResponse.json({ success: true, interviews });
      }

      if (action === 'detail') {
        const interviewId = searchParams.get('id');
        if (!interviewId) return NextResponse.json({ error: 'id required' }, { status: 400 });
        const interview = await col.findOne(createTenantFilter(tenantId, { interviewId }));
        if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ success: true, interview });
      }

      if (action === 'candidate-interviews') {
        const candidateId = searchParams.get('candidateId');
        if (!candidateId) return NextResponse.json({ error: 'candidateId required' }, { status: 400 });
        const interviews = await col.find(createTenantFilter(tenantId, { candidateId })).sort({ round: 1 }).limit(100).toArray();
        return NextResponse.json({ success: true, interviews });
      }

      if (action === 'upcoming') {
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 86400000);
        const interviews = await col.find(createTenantFilter(tenantId, {
          scheduledDate: { $gte: now, $lte: nextWeek },
          status: { $in: ['SCHEDULED', 'CONFIRMED'] },
        })).sort({ scheduledDate: 1 }).limit(20).toArray();
        return NextResponse.json({ success: true, interviews });
      }

      if (action === 'my-interviews') {
        const interviews = await col.find(createTenantFilter(tenantId, {
          'panel.interviewerId': userId,
          status: { $in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
        })).sort({ scheduledDate: 1 }).limit(50).toArray();
        return NextResponse.json({ success: true, interviews });
      }

      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error: unknown) {
      logger.error('[Interviews GET]', error instanceof Error ? error.message : String(error));
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_READ },
);

// ── POST ───────────────────────────────────────────────────────────

export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const { action } = body;
      const col = await getCVisionCollection(tenantId, 'interviews');

      // ── Schedule ──────────────────────────────────────────────

      if (action === 'schedule') {
        const { candidateId, jobId, scheduledDate, scheduledTime, type, duration, location, videoLink, panel, notes } = body;
        if (!candidateId || !scheduledDate || !scheduledTime || !type) {
          return NextResponse.json({ error: 'candidateId, scheduledDate, scheduledTime, type required' }, { status: 400 });
        }

        // Resolve candidate
        const candCol = await getCVisionCollection(tenantId, 'candidates');
        const candidate = await findById(candCol, tenantId, candidateId);
        if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

        // Count existing rounds
        const existingCount = await col.countDocuments(createTenantFilter(tenantId, { candidateId, status: { $ne: 'CANCELLED' } }));
        const round = existingCount + 1;

        // Resolve panel member names from employees
        const empCol = await getCVisionCollection(tenantId, 'employees');
        const resolvedPanel: Array<any> = [];
        if (panel && Array.isArray(panel)) {
          for (const p of panel) {
            const emp = await findById(empCol, tenantId, p.interviewerId) as Record<string, unknown> | null;
            resolvedPanel.push({
              interviewerId: p.interviewerId,
              interviewerName: emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.fullName || 'Unknown' : p.interviewerName || 'Unknown',
              interviewerTitle: emp ? (emp.jobTitle as string) || (emp.positionTitle as string) || '' : '',
              role: p.role || 'MEMBER',
              confirmed: false,
            });
          }
        }

        // Resolve job info
        let jobTitle = '';
        let department = '';
        if (jobId) {
          const reqCol = await getCVisionCollection(tenantId, 'jobRequisitions');
          const req = await findById(reqCol, tenantId, jobId);
          if (req) {
            const reqDoc = req as Record<string, unknown>;
            jobTitle = String(reqDoc.title || '');
            department = String(reqDoc.departmentName || '');
          }
        }

        const interview = {
          tenantId,
          interviewId: `INT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          candidateId,
          candidateName: (candidate as Record<string, unknown>).fullName || '',
          candidateEmail: (candidate as Record<string, unknown>).email || '',
          jobId: jobId || (candidate as Record<string, unknown>).requisitionId || '',
          jobTitle: jobTitle || (candidate as Record<string, unknown>).jobTitleName || '',
          department: department || (candidate as Record<string, unknown>).departmentName || '',
          type: type.toUpperCase(),
          scheduledDate: new Date(scheduledDate),
          scheduledTime,
          duration: duration || 30,
          timezone: 'Asia/Riyadh',
          location: location || undefined,
          videoLink: videoLink || undefined,
          panel: resolvedPanel,
          status: 'SCHEDULED',
          invitationSent: false,
          candidateConfirmed: false,
          feedback: [],
          round,
          notes: notes || undefined,
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await col.insertOne(interview);

        // Move candidate to interview stage if not already
        if ((candidate as Record<string, unknown>).status !== 'interview') {
          await candCol.updateOne(
            createTenantFilter(tenantId, { id: candidateId }),
            { $set: { status: 'interview', statusChangedAt: new Date(), updatedAt: new Date() } },
          );
        }

        // Also push a lightweight reference into the candidate's interviews array for backward compat
        await candCol.updateOne(
          createTenantFilter(tenantId, { id: candidateId }),
          {
            $push: {
              interviews: {
                id: interview.interviewId,
                roundNumber: round,
                type: type.toLowerCase(),
                status: 'scheduled',
                scheduledDate,
                scheduledTime,
                duration: interview.duration,
                location: interview.location,
                interviewers: resolvedPanel.map(p => p.interviewerName),
                notes,
                createdAt: new Date().toISOString(),
                createdBy: userId,
              },
            } as Record<string, unknown>,
          },
        );

        await logCVisionAudit(
          createCVisionAuditContext({ userId, role, tenantId, user }, request),
          'CREATE', 'CANDIDATE',
          { resourceId: interview.interviewId, changes: { after: { round, type, scheduledDate, scheduledTime, event: 'interview_scheduled' } } },
        );

        return NextResponse.json({ success: true, interview }, { status: 201 });
      }

      // ── Send Invitation ───────────────────────────────────────

      if (action === 'send-invitation') {
        const { interviewId } = body;
        if (!interviewId) return NextResponse.json({ error: 'interviewId required' }, { status: 400 });
        const interview = await col.findOne(createTenantFilter(tenantId, { interviewId }));
        if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        await col.updateOne({ _id: interview._id, tenantId }, {
          $set: { invitationSent: true, invitationSentAt: new Date(), updatedAt: new Date() },
        });

        return NextResponse.json({ success: true, sent: true, to: interview.candidateEmail });
      }

      // ── Reschedule ────────────────────────────────────────────

      if (action === 'reschedule') {
        const { interviewId, newDate, newTime, reason } = body;
        if (!interviewId || !newDate || !newTime) return NextResponse.json({ error: 'interviewId, newDate, newTime required' }, { status: 400 });
        const old = await col.findOne(createTenantFilter(tenantId, { interviewId }));
        if (!old) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        await col.updateOne({ _id: old._id, tenantId }, {
          $set: { status: 'RESCHEDULED', rescheduledReason: reason, updatedAt: new Date() },
        });

        // Clone as new interview
        const newInterview = {
          ...old, _id: undefined,
          interviewId: `INT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          scheduledDate: new Date(newDate),
          scheduledTime: newTime,
          status: 'SCHEDULED',
          invitationSent: false,
          candidateConfirmed: false,
          feedback: [],
          decision: undefined, decisionBy: undefined, decisionAt: undefined,
          createdAt: new Date(), updatedAt: new Date(),
          rescheduledFrom: interviewId,
        };
        await col.insertOne(newInterview);

        return NextResponse.json({ success: true, interview: newInterview, oldStatus: 'RESCHEDULED' });
      }

      // ── Cancel ────────────────────────────────────────────────

      if (action === 'cancel') {
        const { interviewId, reason } = body;
        if (!interviewId) return NextResponse.json({ error: 'interviewId required' }, { status: 400 });
        await col.updateOne(
          createTenantFilter(tenantId, { interviewId }),
          { $set: { status: 'CANCELLED', cancelReason: reason, updatedAt: new Date() } },
        );
        return NextResponse.json({ success: true });
      }

      // ── No-show ───────────────────────────────────────────────

      if (action === 'mark-no-show') {
        const { interviewId } = body;
        if (!interviewId) return NextResponse.json({ error: 'interviewId required' }, { status: 400 });
        await col.updateOne(
          createTenantFilter(tenantId, { interviewId }),
          { $set: { status: 'NO_SHOW', updatedAt: new Date() } },
        );
        return NextResponse.json({ success: true });
      }

      // ── Submit Feedback ───────────────────────────────────────

      if (action === 'submit-feedback') {
        const { interviewId, scores, recommendation, strengths, concerns, additionalNotes } = body;
        if (!interviewId || !scores || !recommendation) {
          return NextResponse.json({ error: 'interviewId, scores, recommendation required' }, { status: 400 });
        }

        const interview = await col.findOne(createTenantFilter(tenantId, { interviewId }));
        if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        // Resolve submitter name
        const empCol = await getCVisionCollection(tenantId, 'employees');
        let submitterName = 'Unknown';
        const allEmps = await empCol.find(createTenantFilter(tenantId)).limit(500).toArray();
        const me = allEmps.find((e: any) => e.userId === userId || e.id === userId);
        if (me) {
          const meDoc = me as Record<string, unknown>;
          submitterName = `${meDoc.firstName || ''} ${meDoc.lastName || ''}`.trim() || String(meDoc.fullName || 'Unknown');
        }

        const overallScore = scores.reduce((s: number, sc: any) => s + (Number(sc.score) || 0), 0) / (scores.length || 1);

        const feedbackEntry = {
          interviewerId: userId,
          interviewerName: submitterName,
          scores,
          overallScore: Math.round(overallScore * 10) / 10,
          recommendation,
          strengths: strengths || '',
          concerns: concerns || '',
          additionalNotes: additionalNotes || '',
          submittedAt: new Date(),
        };

        const existingFeedback: Array<any> = interview.feedback || [];
        const alreadyIdx = existingFeedback.findIndex((f: any) => f.interviewerId === userId);
        if (alreadyIdx >= 0) {
          existingFeedback[alreadyIdx] = feedbackEntry;
        } else {
          existingFeedback.push(feedbackEntry);
        }

        // Check if all panel members submitted
        const panelIds = new Set((interview.panel || []).map((p: any) => p.interviewerId));
        const submittedIds = new Set(existingFeedback.map((f: any) => f.interviewerId));
        const allSubmitted = [...panelIds].every(id => submittedIds.has(id));

        await col.updateOne({ _id: interview._id, tenantId }, {
          $set: {
            feedback: existingFeedback,
            status: allSubmitted ? 'COMPLETED' : interview.status,
            updatedAt: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          allFeedbackSubmitted: allSubmitted,
          feedbackCount: existingFeedback.length,
          panelSize: panelIds.size,
        });
      }

      // ── Decide ────────────────────────────────────────────────

      if (action === 'decide') {
        const { interviewId, decision, notes: decisionNotes } = body;
        if (!interviewId || !decision) return NextResponse.json({ error: 'interviewId, decision required' }, { status: 400 });

        const interview = await col.findOne(createTenantFilter(tenantId, { interviewId }));
        if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        await col.updateOne({ _id: interview._id, tenantId }, {
          $set: {
            decision, decisionBy: userId, decisionAt: new Date(),
            decisionNotes: decisionNotes || '',
            status: 'COMPLETED', updatedAt: new Date(),
          },
        });

        // Update candidate pipeline
        const candCol = await getCVisionCollection(tenantId, 'candidates');
        const now = new Date();

        if (decision === 'PASS') {
          await candCol.updateOne(
            createTenantFilter(tenantId, { id: interview.candidateId }),
            { $set: { status: 'offer', statusChangedAt: now, updatedAt: now } },
          );
        } else if (decision === 'FAIL') {
          await candCol.updateOne(
            createTenantFilter(tenantId, { id: interview.candidateId }),
            { $set: { status: 'rejected', statusChangedAt: now, rejectedAt: now, rejectionReason: decisionNotes || 'Failed interview', updatedAt: now } },
          );
        }
        // HOLD and NEXT_ROUND keep candidate at 'interview'

        // Also update the legacy interview sub-doc on the candidate
        const candidateDoc = await findById(candCol, tenantId, interview.candidateId);
        if (candidateDoc) {
          const candDoc = candidateDoc as Record<string, unknown>;
          const legacyInterviews: Array<any> = (candDoc.interviews as Array<any>) || [];
          const legacyIdx = legacyInterviews.findIndex((li) => li.id === interviewId);
          if (legacyIdx >= 0) {
            const decisionLower = decision === 'PASS' ? 'offer' : decision === 'FAIL' ? 'fail' : decision === 'NEXT_ROUND' ? 'next_round' : 'hold';
            legacyInterviews[legacyIdx].status = 'completed';
            legacyInterviews[legacyIdx].decision = decisionLower;
            legacyInterviews[legacyIdx].completedAt = now.toISOString();
            await candCol.updateOne(
              createTenantFilter(tenantId, { id: interview.candidateId }),
              { $set: { interviews: legacyInterviews } },
            );
          }
        }

        await logCVisionAudit(
          createCVisionAuditContext({ userId, role, tenantId, user }, request),
          'STATUS_CHANGE', 'CANDIDATE',
          { resourceId: interviewId, changes: { after: { decision, candidateId: interview.candidateId, event: 'interview_decided' } } },
        );

        return NextResponse.json({
          success: true,
          decision,
          candidateStatus: decision === 'PASS' ? 'offer' : decision === 'FAIL' ? 'rejected' : 'interview',
        });
      }

      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('[Interviews POST]', errMsg);
      return NextResponse.json({ error: 'Internal server error', message: errMsg }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE },
);
