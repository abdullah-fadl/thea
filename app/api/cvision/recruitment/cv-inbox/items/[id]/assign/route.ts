import { logger } from '@/lib/monitoring/logger';
/**
 * CVision CV Inbox Item Assign API
 * POST /api/cvision/recruitment/cv-inbox/items/:id/assign - Assign CV to requisition and create candidate
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
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
import type { CVisionCvInboxItem, CVisionCandidate, CVisionCandidateDocument, CVisionJobRequisition, CVisionCvInboxBatch, CVisionCvParseJob } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canAccessCvInbox } from '@/lib/cvision/authz/policy';
import { analyzeCV } from '@/lib/ai/cv-analyzer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const assignItemSchema = z.object({
  requisitionId: z.string().min(1),
});

// POST - Assign item to requisition
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      // Build authz context
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult; // 401 or 403
      }
      const ctx = ctxResult;

      // Check permission (HR roles only - CV Inbox access)
      const cvInboxPolicy = canAccessCvInbox(ctx);
      const enforceResult = await enforce(cvInboxPolicy, request, ctx);
      if (enforceResult) {
        return enforceResult; // 403
      }

      const resolvedParams = await params;
      const itemId = resolvedParams?.id as string;

      if (!itemId) {
        return NextResponse.json(
          { error: 'Item ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = assignItemSchema.parse(body);

      // Verify item exists
      const itemCollection = await getCVisionCollection<CVisionCvInboxItem>(
        tenantId,
        'cvInboxItems'
      );
      const item = await findById(itemCollection, tenantId, itemId);
      if (!item) {
        return NextResponse.json(
          { error: 'Item not found' },
          { status: 404 }
        );
      }

      // Verify requisition exists and is OPEN
      const requisitionCollection = await getCVisionCollection<CVisionJobRequisition>(
        tenantId,
        'jobRequisitions'
      );
      const requisition = await findById(requisitionCollection, tenantId, data.requisitionId);
      if (!requisition) {
        return NextResponse.json(
          { error: 'Requisition not found' },
          { status: 404 }
        );
      }

      // Require requisition to be OPEN
      if (requisition.status !== 'open') {
        return NextResponse.json(
          { 
            error: 'Requisition is not open',
            code: 'REQUISITION_NOT_OPEN',
            message: `Requisition ${requisition.requisitionNumber} is ${requisition.status}, must be OPEN to assign CVs`,
          },
          { status: 400 }
        );
      }

      // Require assignedRequisitionId to be set (from suggestion or manual selection)
      if (!item.assignedRequisitionId && !data.requisitionId) {
        return NextResponse.json(
          { 
            error: 'No requisition assigned',
            code: 'NO_REQUISITION_ASSIGNED',
            message: 'Item must have an assigned requisition before assignment',
          },
          { status: 400 }
        );
      }

      // Use requisitionId from request body (allows override) or fallback to item's assignedRequisitionId
      const targetRequisitionId = data.requisitionId || item.assignedRequisitionId;
      if (targetRequisitionId !== requisition.id) {
        // If different, verify the target requisition exists and is OPEN
        const targetRequisition = await findById(requisitionCollection, tenantId, targetRequisitionId);
        if (!targetRequisition || targetRequisition.status !== 'open') {
          return NextResponse.json(
            { 
              error: 'Target requisition not found or not open',
              code: 'TARGET_REQUISITION_INVALID',
            },
            { status: 400 }
          );
        }
      }

      // Idempotent: Check if already assigned
      if (item.assignedCandidateId && item.assignedRequisitionId === targetRequisitionId) {
        return NextResponse.json({
          success: true,
          message: 'Item already assigned',
          candidateId: item.assignedCandidateId,
        });
      }

      const now = new Date();

      // Create candidate
      const candidateCollection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );

      // Extract best-effort name from filename (before AI stage)
      const extractedName = item.fileName
        .replace(/\.(pdf|doc|docx)$/i, '')
        .replace(/[_-]/g, ' ')
        .trim();

      // Run AI analysis on extracted text to get structured data
      let cvAnalysis: any = null;
      if (item.extractedRawText && item.extractedRawText.trim().length >= 50) {
        try {
          logger.info('[CV Inbox Assign] Running AI analysis on CV text...');
          cvAnalysis = await analyzeCV(item.extractedRawText, item.fileName);
          logger.info('[CV Inbox Assign] AI analysis result:', {
            name: cvAnalysis?.fullName,
            skills: cvAnalysis?.skills?.length || 0,
            experience: cvAnalysis?.yearsOfExperience || 0,
            education: cvAnalysis?.education?.length || 0,
          });
        } catch (err: any) {
          logger.error('[CV Inbox Assign] AI analysis failed:', err?.message);
        }
      }

      const candidateName = cvAnalysis?.fullName || extractedName || 'Unknown Candidate';

      const candidate: CVisionCandidate = {
        id: uuidv4(),
        tenantId,
        requisitionId: targetRequisitionId,
        fullName: candidateName,
        email: cvAnalysis?.email || null,
        phone: cvAnalysis?.phone || null,
        status: 'applied',
        source: 'PORTAL',
        notes: `Imported from CV Inbox batch ${item.batchId}`,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
        statusChangedAt: now,
        statusReason: null,
        screeningScore: null,
        screenedBy: null,
        screenedAt: null,
        offerStatus: null,
        offerResponseAt: null,
        hiredAt: null,
        employeeId: null,
        isArchived: false,
        metadata: {
          cvInboxItemId: item.id,
          cvInboxBatchId: item.batchId,
          skills: cvAnalysis?.skills || [],
          yearsOfExperience: cvAnalysis?.yearsOfExperience || 0,
          education: cvAnalysis?.education || [],
          experience: cvAnalysis?.experience || [],
          summary: cvAnalysis?.summary || '',
          languages: cvAnalysis?.languages || [],
          certifications: cvAnalysis?.certifications || [],
          nationality: cvAnalysis?.nationality || null,
          cvParsed: !!cvAnalysis,
          cvParsedAt: cvAnalysis ? now.toISOString() : null,
        },
      };

      await candidateCollection.insertOne(candidate);

      // Create CV document for candidate
      const documentCollection = await getCVisionCollection<CVisionCandidateDocument>(
        tenantId,
        'candidateDocuments'
      );

      const document: CVisionCandidateDocument = {
        id: uuidv4(),
        tenantId,
        candidateId: candidate.id,
        kind: 'CV',
        fileName: item.fileName,
        storageKey: item.storageKey || null,
        mimeType: item.mimeType || null,
        fileSize: item.fileSize || null,
        extractedText: item.extractedRawText || null,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      await documentCollection.insertOne(document);

      // Create parse job record so the recommend engine can find the analysis
      if (cvAnalysis) {
        const parseJobCollection = await getCVisionCollection<CVisionCvParseJob>(
          tenantId,
          'cvParseJobs'
        );
        await parseJobCollection.insertOne({
          id: uuidv4(),
          tenantId,
          candidateId: candidate.id,
          documentId: document.id,
          status: 'DONE',
          extractedRawText: item.extractedRawText || null,
          extractedJson: cvAnalysis,
          startedAt: now,
          completedAt: now,
          createdAt: now,
          updatedAt: now,
        } as unknown as CVisionCvParseJob);
      }

      // Update item
      await itemCollection.updateOne(
        createTenantFilter(tenantId, { id: itemId }),
        {
          $set: {
            assignedRequisitionId: targetRequisitionId,
            assignedCandidateId: candidate.id,
            assignedAt: now,
            assignedBy: userId,
            status: 'ASSIGNED',
            updatedAt: now,
            updatedBy: userId,
          },
        }
      );

      // Update batch assigned count
      const batchCollection = await getCVisionCollection<CVisionCvInboxBatch>(
        tenantId,
        'cvInboxBatches'
      );
      const batch = await findById(batchCollection, tenantId, item.batchId);
      if (batch) {
        await batchCollection.updateOne(
          createTenantFilter(tenantId, { id: item.batchId }),
          {
            $set: {
              assignedCount: batch.assignedCount + 1,
              updatedAt: now,
              updatedBy: userId,
            },
          }
        );
      }

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'cv_inbox_item_assign',
        'cv_inbox_item',
        {
          resourceId: itemId,
          changes: {
            before: {
              assignedRequisitionId: null,
              assignedCandidateId: null,
            },
            after: {
              assignedRequisitionId: targetRequisitionId,
              assignedCandidateId: candidate.id,
            },
          },
        }
      );

      return NextResponse.json({
        success: true,
        candidate: {
          id: candidate.id,
          fullName: candidate.fullName,
          requisitionId: candidate.requisitionId,
        },
        document: {
          id: document.id,
          fileName: document.fileName,
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision CV Inbox Item Assign POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
