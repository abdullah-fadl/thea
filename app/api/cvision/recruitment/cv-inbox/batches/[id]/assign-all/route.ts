import { logger } from '@/lib/monitoring/logger';
/**
 * CVision CV Inbox Batch Assign All API
 * POST /api/cvision/recruitment/cv-inbox/batches/:id/assign-all - Assign all items using current assignedRequisitionId or top suggestion
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
import type { CVisionCvInboxBatch, CVisionCvInboxItem, CVisionCandidate, CVisionCandidateDocument, CVisionJobRequisition } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canAccessCvInbox } from '@/lib/cvision/authz/policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST - Assign all items
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
      const batchId = resolvedParams?.id as string;

      if (!batchId) {
        return NextResponse.json(
          { error: 'Batch ID is required' },
          { status: 400 }
        );
      }

      // Verify batch exists
      const batchCollection = await getCVisionCollection<CVisionCvInboxBatch>(
        tenantId,
        'cvInboxBatches'
      );
      const batch = await findById(batchCollection, tenantId, batchId);
      if (!batch) {
        return NextResponse.json(
          { error: 'Batch not found' },
          { status: 404 }
        );
      }

      const itemCollection = await getCVisionCollection<CVisionCvInboxItem>(
        tenantId,
        'cvInboxItems'
      );

      // Get all items with status SUGGESTED or PARSED that have assignedRequisitionId
      const items = await itemCollection
        .find(createTenantFilter(tenantId, { 
          batchId,
          assignedCandidateId: null, // Not yet assigned
          status: { $in: ['SUGGESTED', 'PARSED'] }, // Only items ready for assignment
          assignedRequisitionId: { $ne: null }, // Must have requisition assigned
        }))
        .toArray();

      if (items.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No unassigned items to process',
          assignedCount: 0,
        });
      }

      const now = new Date();
      let assignedCount = 0;
      const skipped: Array<{ itemId: string; reason: string }> = [];

      const requisitionCollection = await getCVisionCollection<CVisionJobRequisition>(
        tenantId,
        'jobRequisitions'
      );

      // Process each item
      for (const item of items) {
        // Use assignedRequisitionId (must be set based on query filter)
        const requisitionId = item.assignedRequisitionId;
        
        if (!requisitionId) {
          skipped.push({ itemId: item.id, reason: 'No requisition assigned' });
          continue;
        }

        // Verify requisition exists and is OPEN
        const requisition = await findById(requisitionCollection, tenantId, requisitionId);
        if (!requisition) {
          skipped.push({ itemId: item.id, reason: `Requisition ${requisitionId} not found` });
          continue;
        }

        if (requisition.status !== 'open') {
          skipped.push({ itemId: item.id, reason: `Requisition ${requisition.requisitionNumber} is ${requisition.status}, must be OPEN` });
          continue;
        }

        // Idempotent check: skip if already assigned
        if (item.assignedCandidateId) {
          skipped.push({ itemId: item.id, reason: 'Already assigned' });
          continue;
        }

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

        const candidate: CVisionCandidate = {
          id: uuidv4(),
          tenantId,
          requisitionId,
          fullName: extractedName || 'Unknown Candidate',
          email: null,
          phone: null,
          status: 'applied',
          source: 'PORTAL', // Phase 1: Use 'PORTAL' for CV Inbox imports
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
          },
        };

        await candidateCollection.insertOne(candidate);

        // Create CV document
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

        // Update item
        await itemCollection.updateOne(
          createTenantFilter(tenantId, { id: item.id }),
          {
            $set: {
              assignedRequisitionId: requisitionId,
              assignedCandidateId: candidate.id,
              assignedAt: now,
              assignedBy: userId,
              status: 'ASSIGNED',
              updatedAt: now,
              updatedBy: userId,
            },
          }
        );

        assignedCount++;
      }

      // Update batch assignedCount (count all items with status ASSIGNED)
      const currentAssignedCount = await itemCollection.countDocuments(
        createTenantFilter(tenantId, { 
          batchId, 
          status: 'ASSIGNED',
        })
      );

      await batchCollection.updateOne(
        createTenantFilter(tenantId, { id: batchId }),
        {
          $set: {
            assignedCount: currentAssignedCount,
            updatedAt: now,
            updatedBy: userId,
          },
        }
      );

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'cv_inbox_batch_assign_all',
        'cv_inbox_batch',
        {
          resourceId: batchId,
          changes: {
            after: {
              assignedCount,
              skippedCount: skipped.length,
              totalItems: items.length,
            },
          },
        }
      );

      return NextResponse.json({
        success: true,
        assignedCount,
        skipped,
        totalItems: items.length,
      });
    } catch (error: any) {
      logger.error('[CVision CV Inbox Batch Assign All POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
