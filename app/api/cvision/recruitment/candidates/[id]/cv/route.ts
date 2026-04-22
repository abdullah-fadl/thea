import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Candidate CV Upload API
 * POST /api/cvision/recruitment/candidates/:id/cv - Upload CV and enqueue parse job
 * 
 * Stores CV metadata and creates a parse job with QUEUED status.
 * All mutations are audited.
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
import type {
  CVisionCandidate,
  CVisionCandidateDocument,
  CVisionCvParseJob,
} from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const uploadCvSchema = z.object({
  fileName: z.string().min(1).max(500),
  storageKey: z.string().max(1000).nullable().optional(), // Optional: only needed if extractedText is not provided
  mimeType: z.string().max(100).optional(),
  fileSize: z.number().int().min(0).optional(),
  extractedText: z.string().max(100000).optional(), // Extracted text from file (preferred for Phase 1)
  analysisJson: z.record(z.string(), z.any()).optional(), // AI analysis result from analyze-cv endpoint
});

// POST - Upload CV and enqueue parse job
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
      const data = uploadCvSchema.parse(body);

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

      const documentCollection = await getCVisionCollection<CVisionCandidateDocument>(
        tenantId,
        'candidateDocuments'
      );
      const parseJobCollection = await getCVisionCollection<CVisionCvParseJob>(
        tenantId,
        'cvParseJobs'
      );

      const now = new Date();

      // Create document record
      // Note: storageKey is optional - if extractedText is provided, we don't need the file on disk
      const document: CVisionCandidateDocument = {
        id: uuidv4(),
        tenantId,
        candidateId,
        kind: 'CV',
        fileName: data.fileName,
        storageKey: data.extractedText ? null : data.storageKey, // Only set storageKey if file needs to be read from disk
        mimeType: data.mimeType || null,
        fileSize: data.fileSize || null,
        extractedText: data.extractedText || null, // Store extracted text if provided (preferred for Phase 1)
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      await documentCollection.insertOne(document);

      // Create parse job — if analysisJson is provided (from analyze-cv), mark as DONE immediately
      const hasAnalysis = data.analysisJson && Object.keys(data.analysisJson).length > 0;
      const parseJob: CVisionCvParseJob = {
        id: uuidv4(),
        tenantId,
        candidateId,
        documentId: document.id,
        status: hasAnalysis ? 'DONE' : 'QUEUED',
        extractedJson: hasAnalysis ? data.analysisJson : null,
        extractedText: data.extractedText || null,
        errors: null,
        createdAt: now,
        updatedAt: now,
        startedAt: hasAnalysis ? now : null,
        completedAt: hasAnalysis ? now : null,
        createdBy: userId,
        updatedBy: userId,
      };

      await parseJobCollection.insertOne(parseJob);

      // Update document with parse job reference (if needed)
      await documentCollection.updateOne(
        createTenantFilter(tenantId, { id: document.id }),
        { $set: { updatedAt: now } }
      );

      // If we have analysis, also update the candidate's metadata so matching has a fallback
      if (hasAnalysis) {
        const analysis = data.analysisJson!;
        await candidateCollection.updateOne(
          createTenantFilter(tenantId, { id: candidateId }),
          {
            $set: {
              'metadata.skills': analysis.skills || [],
              'metadata.yearsOfExperience': analysis.yearsOfExperience || 0,
              'metadata.education': analysis.education || [],
              'metadata.experience': analysis.experience || [],
              'metadata.summary': analysis.summary || '',
              updatedAt: now,
              updatedBy: userId,
            },
          }
        );
      }

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'candidate_cv_upload',
        'candidate',
        {
          resourceId: candidateId,
          changes: {
            after: {
              documentId: document.id,
              fileName: document.fileName,
              parseJobId: parseJob.id,
            },
          },
        }
      );

      return NextResponse.json(
        {
          success: true,
          document: {
            id: document.id,
            fileName: document.fileName,
            storageKey: document.storageKey,
          },
          parseJob: {
            id: parseJob.id,
            status: parseJob.status,
          },
        },
        { status: 201 }
      );
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Candidate CV Upload POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
