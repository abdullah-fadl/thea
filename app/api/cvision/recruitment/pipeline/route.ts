import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Recruitment Pipeline API
 *
 * GET  ?action=kanban          → Kanban view (candidates grouped by stage)
 * GET  ?action=analytics       → Recruitment metrics/dashboard
 * GET  ?action=timeline&id=X   → Candidate timeline
 * GET  ?action=offers          → List offer letters
 * GET  ?action=stages          → Pipeline stage config
 *
 * POST action=move-stage       → Move candidate to a new stage
 * POST action=reject           → Reject candidate
 * POST action=create-offer     → Create draft offer letter
 * POST action=send-offer       → Send offer to candidate
 * POST action=respond-offer    → Accept/reject offer
 * POST action=schedule-interview → Schedule an interview
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getPipelineView,
  getPipeline,
  moveCandidateToStage,
  rejectCandidate,
  createOfferLetter,
  sendOfferLetter,
  respondToOffer,
  getOfferLetters,
  getRecruitmentAnalytics,
  getCandidateTimeline,
  DEFAULT_PIPELINE,
} from '@/lib/cvision/recruitment/pipeline-engine';
import { getCVisionDb } from '@/lib/cvision/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function ok(data: any) { return NextResponse.json({ success: true, ...data }); }
function fail(msg: string, status = 400) { return NextResponse.json({ success: false, error: msg }, { status }); }

export const GET = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const db = await getCVisionDb(tenantId);
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action') || 'kanban';

      if (action === 'kanban') {
        const requisitionId = searchParams.get('requisitionId') || undefined;
        const result = await getPipelineView(db, tenantId, requisitionId);
        return ok(result);
      }

      if (action === 'analytics') {
        const from = searchParams.get('from') || undefined;
        const to = searchParams.get('to') || undefined;
        const dateRange = from && to ? { from, to } : undefined;
        const metrics = await getRecruitmentAnalytics(db, tenantId, dateRange);
        return ok({ metrics });
      }

      if (action === 'timeline') {
        const id = searchParams.get('id');
        if (!id) return fail('Candidate ID required');
        const timeline = await getCandidateTimeline(db, tenantId, id);
        return ok({ timeline });
      }

      if (action === 'offers') {
        const candidateId = searchParams.get('candidateId') || undefined;
        const requisitionId = searchParams.get('requisitionId') || undefined;
        const status = searchParams.get('status') || undefined;
        const offers = await getOfferLetters(db, tenantId, { candidateId, requisitionId, status });
        return ok({ offers });
      }

      if (action === 'stages') {
        const stages = await getPipeline(db, tenantId);
        return ok({ stages });
      }

      return fail('Unknown action');
    } catch (error: any) {
      logger.error('[CVision Pipeline GET]', error?.message || String(error));
      return fail('Internal server error', 500);
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.recruitment.read' },
);

export const POST = withAuthTenant(
  async (request, { tenantId, userId }) => {
    try {
      const db = await getCVisionDb(tenantId);
      const body = await request.json();
      const { action } = body;

      if (action === 'move-stage') {
        const { candidateId, stage, notes } = body;
        if (!candidateId || !stage) return fail('candidateId and stage required');
        const result = await moveCandidateToStage(db, tenantId, candidateId, stage, userId, notes);
        if (!result.success) return fail(result.error || 'Failed to move candidate');
        return ok({ message: `Candidate moved to ${stage}` });
      }

      if (action === 'reject') {
        const { candidateId, reason } = body;
        if (!candidateId || !reason) return fail('candidateId and reason required');
        const result = await rejectCandidate(db, tenantId, candidateId, reason, userId);
        if (!result.success) return fail(result.error || 'Failed to reject candidate');
        return ok({ message: 'Candidate rejected' });
      }

      if (action === 'create-offer') {
        const { candidateId, requisitionId, position, department,
                basicSalary, housingAllowance, transportAllowance,
                otherBenefits, startDate, probationDays, workingHours,
                annualLeaveDays, currency, expiresAt } = body;
        if (!candidateId || !basicSalary) return fail('candidateId and basicSalary required');

        const offer = await createOfferLetter(db, tenantId, {
          candidateId,
          requisitionId: requisitionId || '',
          position: position || '',
          department: department || '',
          basicSalary: basicSalary || 0,
          housingAllowance: housingAllowance || 0,
          transportAllowance: transportAllowance || 0,
          otherBenefits: otherBenefits || [],
          startDate: startDate || new Date().toISOString(),
          probationDays: probationDays || 90,
          workingHours: workingHours || '08:00 - 17:00',
          annualLeaveDays: annualLeaveDays || 21,
          currency: currency || 'SAR',
          expiresAt: new Date(expiresAt || Date.now() + 7 * 86400000),
          createdBy: userId,
        });

        return ok({ offer });
      }

      if (action === 'send-offer') {
        const { offerId } = body;
        if (!offerId) return fail('offerId required');
        const result = await sendOfferLetter(db, tenantId, offerId);
        if (!result.success) return fail(result.error || 'Failed to send offer');
        return ok({ message: 'Offer sent' });
      }

      if (action === 'respond-offer') {
        const { offerId, response, notes } = body;
        if (!offerId || !response) return fail('offerId and response required');
        if (!['ACCEPTED', 'REJECTED'].includes(response)) return fail('response must be ACCEPTED or REJECTED');
        const result = await respondToOffer(db, tenantId, offerId, response, notes);
        if (!result.success) return fail(result.error || 'Failed to respond to offer');
        return ok({ message: `Offer ${response.toLowerCase()}` });
      }

      if (action === 'schedule-interview') {
        const { candidateId, interviewType, scheduledAt, interviewers, location, notes } = body;
        if (!candidateId || !scheduledAt) return fail('candidateId and scheduledAt required');

        const interview = {
          id: new Date().getTime().toString(36),
          type: interviewType || 'GENERAL',
          scheduledAt: new Date(scheduledAt),
          interviewers: interviewers || [],
          location: location || 'TBD',
          notes: notes || '',
          status: 'SCHEDULED',
          createdBy: userId,
          createdAt: new Date(),
        };

        const col = db.collection('cvision_candidates');
        await col.updateOne(
          { tenantId, $or: [{ id: candidateId }] },
          { $push: { interviews: interview } as Record<string, unknown>, $set: { updatedAt: new Date() } },
        );

        // Also move to interview stage if not already there
        const candidate = await col.findOne({ tenantId, id: candidateId });
        if (candidate && !['interview', 'shortlisted', 'offer', 'hired'].includes(candidate.status)) {
          await moveCandidateToStage(db, tenantId, candidateId, 'interview', userId, 'Interview scheduled');
        }

        return ok({ interview, message: 'Interview scheduled' });
      }

      return fail('Unknown action');
    } catch (error: any) {
      logger.error('[CVision Pipeline POST]', error?.message || String(error));
      return fail('Internal server error', 500);
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.recruitment.write' },
);
