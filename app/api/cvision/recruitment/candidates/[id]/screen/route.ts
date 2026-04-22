import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Candidate Screening API
 * POST /api/cvision/recruitment/candidates/[id]/screen - Screen candidate
 */

import { NextRequest, NextResponse } from 'next/server';
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
import { screenCandidateSchema } from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionCandidate, CandidateStatus } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST - Screen candidate
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Candidate ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = screenCandidateSchema.parse(body);

      const collection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );

      const candidate = await findById(collection, tenantId, id);
      if (!candidate) {
        return NextResponse.json(
          { error: 'Candidate not found' },
          { status: 404 }
        );
      }

      // Can only screen candidates in applied or screening status (handle both case conventions)
      const normalizedStatus = candidate.status?.toLowerCase();
      if (!['applied', 'screening'].includes(normalizedStatus)) {
        return NextResponse.json(
          { error: 'Candidate is not in a screenable status' },
          { status: 400 }
        );
      }

      const now = new Date();
      // Use UPPERCASE to match PG enum CvisionCandidateStatus
      let newStatus: CandidateStatus;
      if (data.decision === 'shortlisted') {
        newStatus = 'SHORTLISTED' as CandidateStatus;
      } else if (data.decision === 'interview') {
        newStatus = 'INTERVIEW' as CandidateStatus;
      } else {
        newStatus = 'REJECTED' as CandidateStatus;
      }

      const updateData: Partial<CVisionCandidate> = {
        status: newStatus,
        statusChangedAt: now,
        screeningScore: data.screeningScore,
        notes: data.notes,
        screenedBy: userId,
        screenedAt: now,
        updatedAt: now,
        updatedBy: userId,
      };

      if (data.decision === 'rejected') {
        updateData.statusReason = data.notes || 'Did not pass screening';
      }

      await collection.updateOne(
        createTenantFilter(tenantId, { id }),
        { $set: updateData }
      );

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'candidate_screen',
        'candidate',
        {
          resourceId: id,
          changes: {
            before: { status: candidate.status },
            after: { status: newStatus, screeningScore: data.screeningScore },
          },
          metadata: { decision: data.decision, notes: data.notes },
        }
      );

      const updated = await findById(collection, tenantId, id);

      return NextResponse.json({
        success: true,
        candidate: updated,
        decision: data.decision,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Candidate Screen POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
