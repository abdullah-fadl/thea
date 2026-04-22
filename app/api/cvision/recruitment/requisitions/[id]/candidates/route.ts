import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Requisition Candidates API
 * GET /api/cvision/recruitment/requisitions/:id/candidates - List candidates for requisition
 * POST /api/cvision/recruitment/requisitions/:id/candidates - Create candidate for requisition
 * 
 * Lists or creates candidates linked to a specific requisition.
 * Tenant-scoped and audited.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  findById,
  createTenantFilter,
  paginatedList,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { paginationSchema } from '@/lib/cvision/validation';
import { z } from 'zod';
import type {
  CVisionCandidate,
  CVisionJobRequisition,
} from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createCandidateForRequisitionSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email().max(200).optional(),
  phone: z.string().max(50).optional(),
  source: z.enum(['PORTAL', 'REFERRAL', 'AGENCY', 'OTHER']).default('PORTAL'),
});

// GET - List candidates for requisition
export const GET = withAuthTenant(
  async (request, { tenantId, userId, role }, params) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params || {};
      const requisitionId = resolvedParams?.id as string;

      logger.info('[CVision Requisition Candidates GET]', {
        tenantId,
        userId,
        role,
        requisitionId,
        url: request.url,
        params: resolvedParams,
      });

      if (!requisitionId) {
        return NextResponse.json(
          { error: 'Requisition ID is required' },
          { status: 400 }
        );
      }

      const { searchParams } = new URL(request.url);
      const paramsParsed = paginationSchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
        search: searchParams.get('search'),
        sortBy: searchParams.get('sortBy') || 'createdAt',
        sortOrder: searchParams.get('sortOrder') || 'desc',
        includeDeleted: searchParams.get('includeDeleted'),
      });

      const candidateCollection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );

      const result = await paginatedList(
        candidateCollection,
        tenantId,
        paramsParsed,
        {
          requisitionId,
          isArchived: paramsParsed.includeDeleted ? undefined : { $ne: true },
        }
      );

      logger.info('[CVision Requisition Candidates GET] Result:', {
        tenantId,
        requisitionId,
        count: result.data.length,
        total: result.total,
        page: result.page,
      });

      return NextResponse.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      logger.error('[CVision Requisition Candidates GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_READ }
);

// POST - Create candidate for requisition
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params || {};
      const requisitionId = resolvedParams?.id as string;

      logger.info('[CVision Requisition Candidates POST]', {
        tenantId,
        userId,
        role,
        requisitionId,
        params: resolvedParams,
      });

      if (!requisitionId) {
        return NextResponse.json(
          { error: 'Requisition ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = createCandidateForRequisitionSchema.parse(body);

      // Validate requisition exists
      const requisitionCollection = await getCVisionCollection<CVisionJobRequisition>(
        tenantId,
        'jobRequisitions'
      );
      const requisition = await findById(requisitionCollection, tenantId, requisitionId);
      if (!requisition) {
        logger.info('[CVision Requisition Candidates POST] Requisition not found:', {
          tenantId,
          requisitionId,
        });
        return NextResponse.json(
          { error: 'Job requisition not found' },
          { status: 404 }
        );
      }

      const candidateCollection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );

      // Check for duplicate application (same email + requisition) if email provided
      if (data.email) {
        const existingCandidate = await candidateCollection.findOne(
          createTenantFilter(tenantId, {
            requisitionId,
            email: data.email,
            isArchived: { $ne: true },
          })
        );
        if (existingCandidate) {
          return NextResponse.json(
            { error: 'Candidate with this email has already applied to this position' },
            { status: 409 }
          );
        }
      }

      const now = new Date();
      const candidate: CVisionCandidate = {
        id: uuidv4(),
        tenantId,
        requisitionId,
        fullName: data.fullName,
        email: data.email || null,
        phone: data.phone || null,
        source: data.source,
        referredBy: null,
        status: 'applied',
        statusChangedAt: now,
        statusReason: null,
        screeningScore: null,
        notes: null,
        screenedBy: null,
        screenedAt: null,
        interviews: null,
        offerExtendedAt: null,
        offerAmount: null,
        offerCurrency: null,
        offerStatus: null,
        offerResponseAt: null,
        hiredAt: null,
        employeeId: null,
        isArchived: false,
        metadata: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        createdBy: userId,
        updatedBy: userId,
      };

      await candidateCollection.insertOne(candidate);

      // Update applicant count on requisition
      await requisitionCollection.updateOne(
        createTenantFilter(tenantId, { id: requisitionId }),
        { $inc: { applicantCount: 1 } }
      );

      logger.info('[CVision Requisition Candidates POST] Created:', {
        tenantId,
        requisitionId,
        candidateId: candidate.id,
        candidateName: candidate.fullName,
      });

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'candidate_create',
        'candidate',
        {
          resourceId: candidate.id,
          changes: {
            after: {
              fullName: data.fullName,
              requisitionId,
              source: data.source,
            },
          },
        }
      );

      return NextResponse.json(
        { success: true, candidate },
        { status: 201 }
      );
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Requisition Candidates POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
