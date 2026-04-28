import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Candidate Documents API
 * GET /api/cvision/recruitment/candidates/[id]/documents - List documents
 * POST /api/cvision/recruitment/candidates/[id]/documents - Upload document metadata
 * 
 * Note: This is metadata-only. Actual file storage (S3/etc.) not implemented yet.
 * The storageKey is a placeholder for future integration.
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
import { createCandidateDocumentSchema } from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionCandidate, CVisionCandidateDocument } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - List documents for candidate
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

      // Verify candidate exists
      const candidateCollection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );
      const candidate = await findById(candidateCollection, tenantId, candidateId);
      if (!candidate) {
        return NextResponse.json(
          { error: 'Candidate not found' },
          { status: 404 }
        );
      }

      const docCollection = await getCVisionCollection<CVisionCandidateDocument>(
        tenantId,
        'candidateDocuments'
      );

      const documents = await docCollection
        .find(createTenantFilter(tenantId, { candidateId }))
        .sort({ createdAt: -1 })
        .toArray();

      return NextResponse.json({
        success: true,
        documents,
        total: documents.length,
      });
    } catch (error: any) {
      logger.error('[CVision Candidate Documents GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_READ }
);

// POST - Create document metadata
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

      const body = await request.json();
      
      // Override candidateId from URL param
      const data = createCandidateDocumentSchema.parse({
        ...body,
        candidateId,
      });

      // Verify candidate exists
      const candidateCollection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );
      const candidate = await findById(candidateCollection, tenantId, candidateId);
      if (!candidate) {
        return NextResponse.json(
          { error: 'Candidate not found' },
          { status: 404 }
        );
      }

      const docCollection = await getCVisionCollection<CVisionCandidateDocument>(
        tenantId,
        'candidateDocuments'
      );

      const now = new Date();
      const document: CVisionCandidateDocument = {
        id: uuidv4(),
        tenantId,
        candidateId,
        kind: data.kind,
        fileName: data.fileName,
        storageKey: data.storageKey,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        extractedText: null, // Will be populated by OCR/AI later
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      await docCollection.insertOne(document);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'candidate_update',
        'candidate',
        {
          resourceId: candidateId,
          changes: {
            after: { documentAdded: { kind: data.kind, fileName: data.fileName } },
          },
          metadata: { documentId: document.id },
        }
      );

      return NextResponse.json(
        { success: true, document },
        { status: 201 }
      );
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Candidate Documents POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
