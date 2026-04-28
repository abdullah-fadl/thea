import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Candidate Interviews API
 * GET /api/cvision/recruitment/candidates/:id/interviews - List all interviews
 * POST /api/cvision/recruitment/candidates/:id/interviews - Schedule new interview
 * PUT /api/cvision/recruitment/candidates/:id/interviews - Update interview result
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  findById,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { z } from 'zod';
import type { CVisionCandidate, CandidateInterview } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Validation schemas
const scheduleInterviewSchema = z.object({
  type: z.enum(['phone', 'video', 'in_person', 'technical', 'panel', 'hr']),
  scheduledDate: z.string(),
  scheduledTime: z.string(),
  duration: z.coerce.number().min(15).max(480).optional(),
  location: z.string().max(500).optional(),
  meetingLink: z.string().url().optional(),
  interviewers: z.array(z.string()).min(1),
  notes: z.string().max(5000).optional(),
}).passthrough();

const updateInterviewSchema = z.object({
  interviewId: z.string(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
  score: z.number().min(1).max(10).optional(),
  feedback: z.string().max(10000).optional(),
  decision: z.enum(['pass', 'fail', 'hold', 'next_round', 'offer', 'pending']).optional(),
  aiAnalysis: z.object({
    confidence: z.number().optional(),
    engagement: z.number().optional(),
    stressLevel: z.number().optional(),
    emotionSummary: z.string().optional(),
    observations: z.array(z.string()).optional(),
  }).optional(),
});

// GET - List all interviews for a candidate
export const GET = withAuthTenant(
  async (request, { tenantId }, params) => {
    try {
      const resolvedParams = await params;
      const candidateId = resolvedParams?.id as string;

      if (!candidateId) {
        return NextResponse.json(
          { error: 'Candidate ID is required' },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );

      const candidate = await findById(collection, tenantId, candidateId);
      if (!candidate) {
        return NextResponse.json(
          { error: 'Candidate not found' },
          { status: 404 }
        );
      }

      const interviews = candidate.interviews || [];

      // Sort by round number (most recent first)
      const sortedInterviews = [...interviews].sort((a, b) => b.roundNumber - a.roundNumber);

      return NextResponse.json({
        success: true,
        interviews: sortedInterviews,
        totalRounds: interviews.length,
        candidate: {
          id: candidate.id,
          fullName: candidate.fullName,
          status: candidate.status,
        },
      });
    } catch (error: any) {
      logger.error('[CVision Interviews GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_READ }
);

// POST - Schedule a new interview
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const candidateId = resolvedParams?.id as string;

      if (!candidateId) {
        return NextResponse.json(
          { error: 'Candidate ID is required' },
          { status: 400 }
        );
      }

      let body: any;
      try {
        body = await request.json();
      } catch (parseErr: any) {
        logger.error('[CVision Interviews POST] Body parse error:', parseErr?.message);
        return NextResponse.json(
          { error: 'Invalid JSON body', message: parseErr?.message },
          { status: 400 }
        );
      }

      const parsed = scheduleInterviewSchema.safeParse(body);
      if (!parsed.success) {
        logger.error('[CVision Interviews POST] Validation failed:', {
          candidateId,
          body,
          errors: parsed.error.issues,
        });
        return NextResponse.json(
          { error: 'Validation error', details: parsed.error.issues },
          { status: 400 }
        );
      }
      const data = parsed.data;

      const collection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );

      const candidate = await findById(collection, tenantId, candidateId);
      if (!candidate) {
        return NextResponse.json(
          { error: 'Candidate not found' },
          { status: 404 }
        );
      }

      const existingInterviews = candidate.interviews || [];
      const roundNumber = existingInterviews.length + 1;

      const newInterview: CandidateInterview = {
        id: uuidv4(),
        roundNumber,
        type: data.type,
        status: 'scheduled',
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        duration: data.duration || 60,
        location: data.location,
        meetingLink: data.meetingLink,
        interviewers: data.interviewers,
        notes: data.notes,
        createdAt: new Date().toISOString(),
        createdBy: userId,
      };

      const now = new Date();

      await collection.updateOne(
        createTenantFilter(tenantId, { id: candidateId }),
        {
          $set: {
            status: 'INTERVIEW',
            statusChangedAt: now,
            updatedAt: now,
            updatedBy: userId,
          },
          $push: {
            interviews: newInterview,
          } as Record<string, unknown>,
        }
      );

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'interview_scheduled',
        'candidate',
        {
          resourceId: candidateId,
          changes: {
            after: {
              interviewId: newInterview.id,
              roundNumber,
              type: data.type,
              scheduledDate: data.scheduledDate,
              scheduledTime: data.scheduledTime,
            },
          },
        }
      );

      return NextResponse.json({
        success: true,
        interview: newInterview,
        message: `Interview round ${roundNumber} scheduled successfully`,
      }, { status: 201 });
    } catch (error: any) {
      logger.error('[CVision Interviews POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error?.message || 'Unknown error' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);

// PUT - Update interview result
export const PUT = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const candidateId = resolvedParams?.id as string;

      if (!candidateId) {
        return NextResponse.json(
          { error: 'Candidate ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = updateInterviewSchema.parse(body);

      const collection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );

      const candidate = await findById(collection, tenantId, candidateId);
      if (!candidate) {
        return NextResponse.json(
          { error: 'Candidate not found' },
          { status: 404 }
        );
      }

      const interviews = candidate.interviews || [];
      const interviewIndex = interviews.findIndex(i => i.id === data.interviewId);

      if (interviewIndex === -1) {
        return NextResponse.json(
          { error: 'Interview not found' },
          { status: 404 }
        );
      }

      // Update the interview
      const updatedInterview: CandidateInterview = {
        ...interviews[interviewIndex],
        status: data.status || interviews[interviewIndex].status,
        score: data.score ?? interviews[interviewIndex].score,
        feedback: data.feedback ?? interviews[interviewIndex].feedback,
        decision: data.decision ?? interviews[interviewIndex].decision,
        aiAnalysis: data.aiAnalysis ?? interviews[interviewIndex].aiAnalysis,
        completedAt: data.status === 'completed' ? new Date().toISOString() : interviews[interviewIndex].completedAt,
        completedBy: data.status === 'completed' ? userId : interviews[interviewIndex].completedBy,
      };

      interviews[interviewIndex] = updatedInterview;

      // Determine new candidate status based on decision
      let newStatus = candidate.status;
      if (data.decision === 'offer') {
        newStatus = 'offer';
      } else if (data.decision === 'fail') {
        newStatus = 'rejected';
      }
      // For 'pass', 'hold', 'next_round', 'pending' - keep as 'interview'

      const now = new Date();

      await collection.updateOne(
        createTenantFilter(tenantId, { id: candidateId }),
        {
          $set: {
            interviews,
            status: newStatus,
            statusChangedAt: newStatus !== candidate.status ? now : candidate.statusChangedAt,
            screeningScore: data.score ? data.score * 10 : candidate.screeningScore,
            updatedAt: now,
            updatedBy: userId,
          },
        }
      );

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'interview_updated',
        'candidate',
        {
          resourceId: candidateId,
          changes: {
            before: { interviewId: data.interviewId },
            after: {
              status: data.status,
              score: data.score,
              decision: data.decision,
            },
          },
        }
      );

      return NextResponse.json({
        success: true,
        interview: updatedInterview,
        candidateStatus: newStatus,
        message: 'Interview updated successfully',
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Interviews PUT]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
