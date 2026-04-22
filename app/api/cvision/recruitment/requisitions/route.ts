import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Job Requisitions API
 * GET /api/cvision/recruitment/requisitions - List requisitions
 * POST /api/cvision/recruitment/requisitions - Create requisition
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import type { Filter } from 'mongodb';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  paginatedList,
  createTenantFilter,
  generateSequenceNumber,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import {
  createJobRequisitionSchema,
  paginationSchema,
} from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS, SEQUENCE_PREFIXES } from '@/lib/cvision/constants';
import type { CVisionJobRequisition, RequisitionApproval } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canListRequisitions } from '@/lib/cvision/authz/policy';
import { hasTenantWideAccess } from '@/lib/cvision/authz/context';
import { CVISION_ROLES } from '@/lib/cvision/roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - List requisitions
export const GET = withAuthTenant(
  async (request, { tenantId, role, user }) => {
    try {
      // Build authz context
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult; // 401 or 403
      }
      const ctx = ctxResult;

      logger.info('[CVision Requisitions GET]', {
        tenantId,
        userId: user?.id,
        role,
        userRole: user?.role,
        ctxRoles: ctx.roles,
        ctxIsOwner: ctx.isOwner,
        url: request.url,
      });

      // Enforce list policy
      const listPolicy = canListRequisitions(ctx);
      const enforceResult = await enforce(listPolicy, request, ctx);
      if (enforceResult) {
        logger.error('[CVision Requisitions GET] Policy denied:', {
          tenantId,
          userId: user?.id,
          role,
          userRole: user?.role,
          ctxRoles: ctx.roles,
          policyResult: listPolicy,
          enforceResult: enforceResult.status,
        });
        return enforceResult; // 403
      }

      const { searchParams } = new URL(request.url);
      let paramsParsed;
      try {
        paramsParsed = paginationSchema.parse({
          page: searchParams.get('page'),
          limit: searchParams.get('limit'),
          search: searchParams.get('search'),
          sortBy: searchParams.get('sortBy') || 'createdAt',
          sortOrder: searchParams.get('sortOrder') || 'desc',
          includeDeleted: searchParams.get('includeDeleted'),
        });
      } catch (parseError: unknown) {
        const pe = parseError as Record<string, unknown>;
        logger.error('[CVision Requisitions GET] Pagination parse error:', pe?.errors || pe?.message || String(parseError));
        return NextResponse.json(
          { error: 'Invalid pagination parameters', details: pe?.errors || pe?.message },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionJobRequisition>(
        tenantId,
        'jobRequisitions'
      );

      // Build additional filter
      const additionalFilter: any = {};
      
      const status = searchParams.get('status');
      const departmentId = searchParams.get('departmentId');
      const reason = searchParams.get('reason');

      if (status) additionalFilter.status = status;
      if (departmentId) additionalFilter.departmentId = departmentId;
      if (reason) additionalFilter.reason = reason;

      // Filter out archived unless explicitly requested
      if (!paramsParsed.includeDeleted) {
        additionalFilter.isArchived = { $ne: true };
      }

      // Apply department-based access control
      // OWNER and tenant-wide access users see all requisitions
      const hasWideAccess = hasTenantWideAccess(ctx) || 
                            ctx.roles.includes(CVISION_ROLES.OWNER) || 
                            ctx.isOwner;
      
      if (!hasWideAccess) {
        // Non-admin users: restrict to their department(s)
        if (ctx.departmentIds.length > 0) {
          additionalFilter.departmentId = { $in: ctx.departmentIds };
        } else {
          // No department assigned: return empty result instead of impossible filter
          return NextResponse.json({
            success: true,
            data: [],
            total: 0,
            page: paramsParsed.page,
            limit: paramsParsed.limit,
            hasMore: false,
          });
        }
      }

      let result;
      try {
        result = await paginatedList(
          collection,
          tenantId,
          paramsParsed,
          Object.keys(additionalFilter).length > 0 ? additionalFilter : undefined
        );
      } catch (listError: unknown) {
        const le = listError instanceof Error ? listError : { message: String(listError), stack: undefined };
        logger.error('[CVision Requisitions GET] Paginated list error:', {
          error: le.message,
          stack: le.stack,
          tenantId,
          filter: additionalFilter,
        });
        return NextResponse.json(
          { error: 'Failed to fetch requisitions', message: le.message || 'Database query failed' },
          { status: 500 }
        );
      }

      // Enrich requisitions with department and job title names
      const deptCol = await getCVisionCollection(tenantId, 'departments');
      const departments = await deptCol.find(createTenantFilter(tenantId)).limit(500).toArray();
      const deptNameMap: Record<string, string> = {};
      for (const d of departments) {
        const doc = d as Record<string, unknown>;
        deptNameMap[doc.id as string] = (doc.name as string) || (doc.id as string);
      }

      const jtCol = await getCVisionCollection(tenantId, 'jobTitles');
      const allJobTitles = await jtCol.find(createTenantFilter(tenantId)).limit(500).toArray();
      const jtNameMap: Record<string, string> = {};
      for (const jt of allJobTitles) {
        const doc = jt as Record<string, unknown>;
        jtNameMap[doc.id as string] = (doc.name as string) || (doc.id as string);
      }

      // Update applicantCount from actual candidates count and ensure backward compatibility
      const candidateCollection = await getCVisionCollection(tenantId, 'candidates');
      for (const req of result.data) {
        try {
          const candidateCount = await candidateCollection.countDocuments(
            createTenantFilter(tenantId, {
              requisitionId: req.id,
              isArchived: { $ne: true },
            })
          );
          // Update applicantCount if different
          if (req.applicantCount !== candidateCount) {
            await collection.updateOne(
              createTenantFilter(tenantId, { id: req.id }),
              { $set: { applicantCount: candidateCount } }
            );
            req.applicantCount = candidateCount;
          }
          
          // PR-B: Ensure backward compatibility - add default values for missing fields
          if (!req.headcountRequested) {
            req.headcountRequested = req.headcount || 1;
          }
          
          // Ensure all PR-B fields exist (for backward compatibility with old requisitions)
          if (!req.jobTitleId) {
            req.jobTitleId = null;
          }
          if (!req.positionId) {
            req.positionId = null;
          }

          // Resolve department and job title names
          if (req.departmentId) {
            (req as Record<string, unknown>).departmentName = deptNameMap[req.departmentId] || req.departmentId;
          }
          if (req.jobTitleId) {
            (req as Record<string, unknown>).jobTitleName = jtNameMap[req.jobTitleId] || req.jobTitleId;
          }
        } catch (err: unknown) {
          logger.error(`[CVision Requisitions GET] Error processing requisition ${req.id}:`, err instanceof Error ? err.message : String(err));
          // Continue processing other requisitions - set defaults
          req.headcountRequested = req.headcount || 1;
          req.jobTitleId = req.jobTitleId || null;
          req.positionId = req.positionId || null;
          // Still resolve names even on error
          if (req.departmentId) {
            (req as Record<string, unknown>).departmentName = deptNameMap[req.departmentId] || req.departmentId;
          }
          if (req.jobTitleId) {
            (req as Record<string, unknown>).jobTitleName = jtNameMap[req.jobTitleId] || req.jobTitleId;
          }
        }
      }

      logger.info('[CVision Requisitions GET] Result:', {
        tenantId,
        count: result.data.length,
        total: result.total,
        page: result.page,
        requisitions: result.data.map((r) => ({
          id: r.id,
          number: r.requisitionNumber,
          applicantCount: r.applicantCount,
        })),
      });

      return NextResponse.json({
        success: true,
        ...result,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : { message: String(error), stack: undefined, name: undefined };
      const zodErrors = (error as Record<string, unknown>)?.errors;
      logger.error('[CVision Requisitions GET] Error:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
        errors: zodErrors,
        tenantId,
        userId: user?.id,
        role,
      });
      return NextResponse.json(
        {
          error: 'Internal server error',
          message: err.message,
          ...(process.env.NODE_ENV === 'development' && {
            details: zodErrors || err.stack,
          }),
        },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_READ }
);

// POST - Create requisition
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const data = createJobRequisitionSchema.parse(body);

      // PR-B: Validate Draft requisition requirements
      // For Draft status, require departmentId + jobTitleId + positionId
      const rawStatus = (body as Record<string, unknown>).status;
      // Normalize to PG enum UPPERCASE; accept lowercase for backward compat
      const initialStatus = rawStatus
        ? String(rawStatus).toUpperCase()
        : 'DRAFT';
      if (initialStatus === 'DRAFT') {
        if (!data.departmentId || !data.jobTitleId || !data.positionId) {
          return NextResponse.json(
            {
              error: 'Draft requisitions require departmentId, jobTitleId, and positionId',
              code: 'MISSING_REQUIRED_FIELDS',
              missing: {
                departmentId: !data.departmentId,
                jobTitleId: !data.jobTitleId,
                positionId: !data.positionId,
              },
            },
            { status: 400 }
          );
        }
      }

      // Validate department exists
      const deptCollection = await getCVisionCollection(tenantId, 'departments');
      const department = await deptCollection.findOne(
        createTenantFilter(tenantId, { id: data.departmentId })
      );
      if (!department) {
        return NextResponse.json(
          { error: 'Department not found' },
          { status: 400 }
        );
      }

      // Generate requisition number (with duplicate detection retry)
      const reqCol = await getCVisionCollection(tenantId, 'jobRequisitions');
      let requisitionNumber = await generateSequenceNumber(
        tenantId,
        SEQUENCE_PREFIXES.requisition
      );
      // Retry up to 10 times if the generated number already exists (stale sequence counter)
      for (let attempt = 0; attempt < 10; attempt++) {
        const existing = await reqCol.findOne(createTenantFilter(tenantId, { requisitionNumber } as Filter<CVisionJobRequisition>));
        if (!existing) break;
        logger.warn(`[Requisition] Duplicate JR detected: ${requisitionNumber}, retrying...`);
        requisitionNumber = await generateSequenceNumber(
          tenantId,
          SEQUENCE_PREFIXES.requisition
        );
      }

      const now = new Date();

      // Initialize approval chain: department manager -> HR admin
      const initialApprovals: RequisitionApproval[] = [];

      // Step 1: Look up department manager
      let deptManagerUserId: string | null = null;
      const dept = department as Record<string, unknown>;
      if (dept.managerId) {
        const empCollection = await getCVisionCollection(tenantId, 'employees');
        const managerEmployee = await empCollection.findOne(
          createTenantFilter(tenantId, { id: dept.managerId })
        );
        if (managerEmployee && (managerEmployee as Record<string, unknown>).userId) {
          deptManagerUserId = (managerEmployee as Record<string, unknown>).userId as string;
        }
      }

      // Step 2: Look up first active HR admin user for the tenant
      const tenantDb = await (await import('@/lib/cvision/infra')).getTenantDbByKey(tenantId);
      const tenantUsersCol = tenantDb.collection('cvision_tenant_users');
      const hrAdminUser = await tenantUsersCol.findOne({
        tenantId,
        role: { $in: ['HR_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'OWNER'] },
        isActive: true,
      });
      const hrAdminUserId: string | null = hrAdminUser ? (hrAdminUser as Record<string, unknown>).userId as string : null;

      // Build approval chain based on available approvers
      let stepOrder = 0;

      if (deptManagerUserId) {
        // Don't add manager as approver if they are the creator
        if (deptManagerUserId !== userId) {
          initialApprovals.push({
            userId: deptManagerUserId,
            role: 'manager',
            approved: false,
            approvedAt: now,
            status: 'pending',
            stepOrder,
            stepLabel: 'Department Manager',
          });
          stepOrder++;
        }
      }

      if (hrAdminUserId) {
        // Don't add HR admin if they are the same as the department manager already added
        const alreadyAdded = initialApprovals.some(a => a.userId === hrAdminUserId);
        if (!alreadyAdded) {
          initialApprovals.push({
            userId: hrAdminUserId,
            role: 'hr_admin',
            approved: false,
            approvedAt: now,
            status: 'pending',
            stepOrder,
            stepLabel: 'HR Admin',
          });
          stepOrder++;
        }
      }

      // If no approvers found (small company), auto-approve scenario:
      // Add a placeholder so the chain is never empty (keeps backward compat)
      if (initialApprovals.length === 0) {
        initialApprovals.push({
          userId: userId, // Creator auto-approves
          role: 'auto',
          approved: true,
          approvedAt: now,
          status: 'approved',
          stepOrder: 0,
          stepLabel: 'Auto-approved (no approvers configured)',
        });
      }

      // Budget guard: Check if positionId is provided and if status will be 'open'
      // Note: Requisitions are created as 'draft' by default, so we only check if status is explicitly 'open'
      if (initialStatus === 'OPEN' && data.positionId) {
        const { checkBudgetSlot } = await import('@/lib/cvision/budget/guard');
        const budgetCheck = await checkBudgetSlot(tenantId, data.positionId, data.headcount);
        if (!budgetCheck.allowed) {
          return NextResponse.json(
            {
              error: 'No available slots for this position',
              code: 'NO_BUDGET_SLOT',
              message: budgetCheck.reason || `Available slots: ${budgetCheck.availableSlots}, Required: ${data.headcount}`,
              availableSlots: budgetCheck.availableSlots,
            },
            { status: 409 }
          );
        }
      }

      // Manpower plan linkage
      const manpowerLink = (body as Record<string, unknown>).source === 'MANPOWER_PLAN' && data.positionId
        ? {
            positionId: data.positionId,
            budgetedCount: data.headcountRequested || data.headcount || 1,
            createdFromManpower: true,
            linkedAt: now,
          }
        : undefined;

      // Only include fields that exist as columns in cvision_job_requisitions PG table.
      // PG columns: id, tenantId, requisitionNumber, title, description, departmentId,
      // unitId, jobTitleId, gradeId, positionId, headcountRequested, reason,
      // employmentType, requirements, skills, experienceYears, salaryRange, status,
      // statusChangedAt, statusReason, approvals (NOT approvalsJson), createdByUserId,
      // submittedAt, submittedBy, approvedAt, approvedBy, openedAt, closedAt,
      // targetStartDate, closingDate, applicantCount, isArchived, metadata,
      // createdAt, updatedAt, createdBy, updatedBy, deletedAt
      //
      // NOT in PG (stripped): headcount (use headcountRequested), approvalsJson → approvals,
      //   manpowerLink
      const requisition: any = {
        id: uuidv4(),
        tenantId,
        requisitionNumber,
        title: data.title,
        description: data.description || null,
        departmentId: data.departmentId,
        unitId: data.unitId || null,
        jobTitleId: data.jobTitleId || null,
        gradeId: data.gradeId || null,
        positionId: data.positionId || null,
        headcountRequested: data.headcountRequested || data.headcount || 1,
        reason: (data.reason ? String(data.reason).toUpperCase() : 'NEW_POSITION') as CVisionJobRequisition['reason'],
        employmentType: data.employmentType || null,
        requirements: data.requirements || null,
        skills: data.skills || null,
        experienceYears: data.experienceYears || null,
        salaryRange: data.salaryRange || null,
        status: initialStatus as CVisionJobRequisition['status'],
        statusChangedAt: now,
        approvals: initialApprovals, // PG column is 'approvals', not 'approvalsJson'
        createdByUserId: userId,
        applicantCount: 0,
        isArchived: false,
        metadata: data.metadata || null,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
        deletedAt: null,
      } as unknown as CVisionJobRequisition;

      const collection = await getCVisionCollection<CVisionJobRequisition>(
        tenantId,
        'jobRequisitions'
      );
      await collection.insertOne(requisition);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'requisition_create',
        'requisition',
        {
          resourceId: requisition.id,
          changes: { after: { requisitionNumber, title: data.title, reason: data.reason } },
        }
      );

      return NextResponse.json(
        { success: true, requisition },
        { status: 201 }
      );
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: (error as any).errors },
          { status: 400 }
        );
      }
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[CVision Requisitions POST]', msg);
      return NextResponse.json(
        { error: 'Internal server error', message: msg },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
