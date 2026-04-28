import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Candidates API
 * GET /api/cvision/recruitment/candidates - List candidates
 * POST /api/cvision/recruitment/candidates - Create candidate
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  paginatedList,
  createTenantFilter,
  findById,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import {
  createCandidateSchema,
  paginationSchema,
} from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionCandidate, CVisionJobRequisition } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canReadCandidate, canWriteCandidate } from '@/lib/cvision/authz/policy';
import { hasTenantWideAccess, isCandidate } from '@/lib/cvision/authz/context';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - List candidates
export const GET = withAuthTenant(
  async (request, { tenantId, userId, role }) => {
    try {
      // Build authz context
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult; // 401 or 403
      }
      const ctx = ctxResult;

      const { searchParams } = new URL(request.url);
      const requisitionId = searchParams.get('requisitionId');
      
      logger.info('[CVision Candidates GET]', {
        tenantId,
        userId,
        role,
        requisitionId,
        url: request.url,
      });

      const paramsParsed = paginationSchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
        search: searchParams.get('search'),
        sortBy: searchParams.get('sortBy') || 'createdAt',
        sortOrder: searchParams.get('sortOrder') || 'desc',
        includeDeleted: searchParams.get('includeDeleted'),
      });

      const collection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );

      // Build additional filter
      const additionalFilter: any = {};
      
      const status = searchParams.get('status');
      const source = searchParams.get('source');

      if (requisitionId) additionalFilter.requisitionId = requisitionId;
      if (status) additionalFilter.status = status;
      if (source) additionalFilter.source = source;

      // Filter out archived unless requested
      if (!paramsParsed.includeDeleted) {
        additionalFilter.isArchived = { $ne: true };
      }

      // Apply access control: candidates can only see their own applications
      if (isCandidate(ctx)) {
        // Candidates can only see their own records (by userId or email)
        additionalFilter.$or = [
          { userId: ctx.userId },
          { email: ctx.user.email },
        ];
      } else if (!hasTenantWideAccess(ctx)) {
        // Non-admin users: filter by department via requisition (handled at API level)
        // For now, allow if they have department access
        if (ctx.departmentIds.length === 0) {
          additionalFilter._impossible = true;
        }
      }

      const result = await paginatedList(
        collection,
        tenantId,
        paramsParsed,
        Object.keys(additionalFilter).length > 0 ? additionalFilter : undefined
      );

      // Enrich candidates with department and job title names
      if (result.data.length > 0) {
        const deptCol = await getCVisionCollection(tenantId, 'departments');
        const departments = await deptCol.find(createTenantFilter(tenantId)).limit(500).toArray();
        const deptNameMap: Record<string, string> = {};
        for (const d of departments) {
          deptNameMap[(d as Record<string, string>).id] = (d as Record<string, string>).name || (d as Record<string, string>).id;
        }

        const jtCol = await getCVisionCollection(tenantId, 'jobTitles');
        const jobTitles = await jtCol.find(createTenantFilter(tenantId)).limit(500).toArray();
        const jtNameMap: Record<string, string> = {};
        for (const jt of jobTitles) {
          jtNameMap[(jt as Record<string, string>).id] = (jt as Record<string, string>).name || (jt as Record<string, string>).id;
        }

        for (const candidate of result.data) {
          if (candidate.departmentId) {
            (candidate as Record<string, unknown>).departmentName = deptNameMap[candidate.departmentId] || candidate.departmentId;
          }
          if (candidate.jobTitleId) {
            (candidate as Record<string, unknown>).jobTitleName = jtNameMap[candidate.jobTitleId] || candidate.jobTitleId;
          }
        }
      }

      logger.info('[CVision Candidates GET] Result:', {
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
      logger.error('[CVision Candidates GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_READ }
);

// POST - Create candidate (intake)
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const data = createCandidateSchema.parse(body);

      const collection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );

      let requisitionId = data.requisitionId;
      let departmentId = data.departmentId;
      let jobTitleId = data.jobTitleId;

      // If requisitionId provided, validate it
      if (requisitionId) {
        const requisitionCollection = await getCVisionCollection<CVisionJobRequisition>(
          tenantId,
          'jobRequisitions'
        );
        const requisition = await findById(requisitionCollection, tenantId, requisitionId);
        if (!requisition) {
          return NextResponse.json(
            { error: 'Job requisition not found' },
            { status: 400 }
          );
        }
        if (requisition.status !== 'open' && requisition.status !== 'OPEN') {
          return NextResponse.json(
            { error: 'Job requisition is not open for applications' },
            { status: 400 }
          );
        }

        // Get department and job title from requisition if not provided
        departmentId = departmentId || requisition.departmentId;
        jobTitleId = jobTitleId || requisition.jobTitleId || undefined;

        // Check for duplicate application (same email + requisition) if email provided
        if (data.email) {
          const existingCandidate = await collection.findOne(
            createTenantFilter(tenantId, {
              requisitionId: requisitionId,
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
      }

      const now = new Date();
      const candidate: CVisionCandidate = {
        id: uuidv4(),
        tenantId,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        requisitionId: requisitionId || null,
        departmentId: departmentId || null,
        jobTitleId: jobTitleId || null,
        source: data.source,
        referredBy: data.referredBy || null,
        status: 'APPLIED',
        statusChangedAt: now,
        notes: data.notes,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
        metadata: data.metadata,
      };

      await collection.insertOne(candidate);

      // Update applicant count on requisition if linked
      if (requisitionId) {
        const requisitionCollection = await getCVisionCollection<CVisionJobRequisition>(
          tenantId,
          'jobRequisitions'
        );
        await requisitionCollection.updateOne(
          createTenantFilter(tenantId, { id: requisitionId }),
          { $inc: { applicantCount: 1 } }
        );
      }

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'candidate_create',
        'candidate',
        {
          resourceId: candidate.id,
          changes: { after: { fullName: data.fullName, requisitionId: data.requisitionId } },
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
      logger.error('[CVision Candidates POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
