import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Candidate by ID API
 * GET /api/cvision/recruitment/candidates/[id] - Get candidate
 * PUT /api/cvision/recruitment/candidates/[id] - Update candidate or change status
 * DELETE /api/cvision/recruitment/candidates/[id] - Archive candidate
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
  computeChanges,
} from '@/lib/cvision/audit';
import { updateCandidateSchema, changeCandidateStatusSchema, screenCandidateSchema } from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS, CANDIDATE_STATUS_TRANSITIONS } from '@/lib/cvision/constants';
import type {
  CVisionCandidate,
  CandidateStatus,
  CVisionCandidateDocument,
  CVisionCvParseJob,
} from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get candidate by ID (includes documents)
export const GET = withAuthTenant(
  async (request, { tenantId, userId, role }, params) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params || {};
      const id = resolvedParams?.id as string;

      logger.info('[CVision Candidate GET]', {
        tenantId,
        userId,
        role,
        candidateId: id,
        url: request.url,
        params: resolvedParams,
      });

      if (!id) {
        return NextResponse.json(
          { error: 'Candidate ID is required' },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );

      const candidate = await findById(collection, tenantId, id);

      if (!candidate) {
        logger.info('[CVision Candidate GET] Not found:', { tenantId, candidateId: id });
        return NextResponse.json(
          { error: 'Candidate not found' },
          { status: 404 }
        );
      }

      // Fetch documents
      const docCollection = await getCVisionCollection<CVisionCandidateDocument>(
        tenantId,
        'candidateDocuments'
      );
      const documents = await docCollection
        .find(createTenantFilter(tenantId, { candidateId: id }))
        .sort({ createdAt: -1 })
        .toArray();

      // Fetch parse jobs for CV documents
      const parseJobCollection = await getCVisionCollection<CVisionCvParseJob>(
        tenantId,
        'cvParseJobs'
      );
      const cvDocumentIds = documents.filter((d) => d.kind === 'CV').map((d) => d.id);
      const parseJobs = cvDocumentIds.length > 0
        ? await parseJobCollection
            .find(createTenantFilter(tenantId, { documentId: { $in: cvDocumentIds } }))
            .sort({ createdAt: -1 })
            .toArray()
        : [];

      // Get latest parse job for latest CV document
      const latestCvDoc = documents.find((d) => d.kind === 'CV');
      const latestParseJob = latestCvDoc
        ? parseJobs.find((j) => j.documentId === latestCvDoc.id) || null
        : null;

      logger.info('[CVision Candidate GET] Result:', {
        tenantId,
        candidateId: id,
        found: !!candidate,
        documentsCount: documents.length,
        parseJobsCount: parseJobs.length,
        hasLatestParseJob: !!latestParseJob,
      });

      return NextResponse.json({
        success: true,
        candidate,
        documents,
        parseJobs,
        latestParseJob,
      });
    } catch (error: any) {
      logger.error('[CVision Candidate GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_READ }
);

// PUT - Update candidate, change status, or screen
export const PUT = withAuthTenant(
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

      const collection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );

      const existing = await findById(collection, tenantId, id);
      if (!existing) {
        return NextResponse.json(
          { error: 'Candidate not found' },
          { status: 404 }
        );
      }

      const now = new Date();

      // Handle screening action
      if (body.action === 'screen') {
        const screenData = screenCandidateSchema.parse(body);

        const normalizedStatus = existing.status?.toLowerCase();
        if (normalizedStatus !== 'applied' && normalizedStatus !== 'screening' && normalizedStatus !== 'new') {
          return NextResponse.json(
            { error: 'Can only screen candidates in applied, new, or screening status' },
            { status: 400 }
          );
        }

        // Map decision to status (UPPERCASE for PG enum CvisionCandidateStatus)
        let newStatus: CandidateStatus;
        if (screenData.decision === 'shortlisted') {
          newStatus = 'SHORTLISTED' as CandidateStatus;
        } else if (screenData.decision === 'interview') {
          newStatus = 'INTERVIEW' as CandidateStatus;
        } else {
          newStatus = 'REJECTED' as CandidateStatus;
        }

        const updateData: Partial<CVisionCandidate> = {
          status: newStatus,
          statusChangedAt: now,
          screeningScore: screenData.screeningScore,
          notes: screenData.notes || existing.notes,
          screenedBy: userId,
          screenedAt: now,
          updatedAt: now,
          updatedBy: userId,
        };

        await collection.updateOne(
          createTenantFilter(tenantId, { id }),
          { $set: updateData }
        );

        await logCVisionAudit(
          createCVisionAuditContext({ userId, role, tenantId, user }, request),
          'candidate_screen',
          'candidate',
          {
            resourceId: id,
            changes: {
              before: { status: existing.status },
              after: { status: newStatus, screeningScore: screenData.screeningScore },
            },
          }
        );

        const updated = await findById(collection, tenantId, id);
        return NextResponse.json({ success: true, candidate: updated });
      }

      // Handle status change
      if (body.status && body.status !== existing.status) {
        const statusData = changeCandidateStatusSchema.parse(body);

        // Validate status transition
        const allowedTransitions = CANDIDATE_STATUS_TRANSITIONS[existing.status] || [];
        if (!allowedTransitions.includes(statusData.status)) {
          return NextResponse.json(
            {
              error: 'Invalid status transition',
              message: `Cannot transition from '${existing.status}' to '${statusData.status}'. Allowed: ${allowedTransitions.join(', ') || 'none'}`,
            },
            { status: 400 }
          );
        }

        const updateData: Partial<CVisionCandidate> = {
          status: statusData.status as CandidateStatus,
          statusChangedAt: now,
          statusReason: statusData.reason,
          updatedAt: now,
          updatedBy: userId,
        };

        // Handle hire action
        if (statusData.status === 'hired') {
          updateData.hiredAt = now;
        }

        await collection.updateOne(
          createTenantFilter(tenantId, { id }),
          { $set: updateData }
        );

        await logCVisionAudit(
          createCVisionAuditContext({ userId, role, tenantId, user }, request),
          'candidate_stage_change',
          'candidate',
          {
            resourceId: id,
            changes: {
              before: { status: existing.status },
              after: { status: statusData.status },
            },
            metadata: { reason: statusData.reason },
          }
        );

        const updated = await findById(collection, tenantId, id);
        return NextResponse.json({ success: true, candidate: updated });
      }

      // Regular update
      const data = updateCandidateSchema.parse(body);

      const updateData = {
        ...data,
        updatedAt: now,
        updatedBy: userId,
      };

      await collection.updateOne(
        createTenantFilter(tenantId, { id }),
        { $set: updateData }
      );

      const updated = await findById(collection, tenantId, id);

      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'candidate_update',
        'candidate',
        {
          resourceId: id,
          changes: computeChanges(existing, updated!),
        }
      );

      return NextResponse.json({ success: true, candidate: updated });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Candidate PUT]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);

// DELETE - Archive candidate (soft delete)
export const DELETE = withAuthTenant(
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

      const collection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );

      const existing = await findById(collection, tenantId, id);
      if (!existing) {
        return NextResponse.json(
          { error: 'Candidate not found' },
          { status: 404 }
        );
      }

      const now = new Date();
      await collection.updateOne(
        createTenantFilter(tenantId, { id }),
        {
          $set: {
            isArchived: true,
            deletedAt: now,
            updatedAt: now,
            updatedBy: userId,
          },
        }
      );

      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'candidate_update',
        'candidate',
        {
          resourceId: id,
          changes: { before: { isArchived: false }, after: { isArchived: true } },
        }
      );

      return NextResponse.json({ success: true, message: 'Candidate archived' });
    } catch (error: any) {
      logger.error('[CVision Candidate DELETE]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
