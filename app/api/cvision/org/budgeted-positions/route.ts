import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Budgeted Positions API (PR-D: Budget v1)
 * 
 * GET /api/cvision/org/budgeted-positions - List budgeted positions with computed metrics
 * POST /api/cvision/org/budgeted-positions - Create budgeted position
 * 
 * Computed metrics per position:
 * - occupiedHeadcount: count employees where positionId=this.id and status in (ACTIVE, PROBATION)
 * - openRequisitions: count requisitions where positionId=this.id and status=OPEN
 * - availableSlots: budgetedHeadcount - occupiedHeadcount - openRequisitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canReadOrg, canWriteOrg } from '@/lib/cvision/authz/policy';
import { getCVisionCollection, getCVisionDb, createTenantFilter, paginatedList } from '@/lib/cvision/db';
import type { CVisionBudgetedPosition, CVisionEmployee, CVisionJobRequisition, CVisionJobTitle } from '@/lib/cvision/types';
import { v4 as uuidv4 } from 'uuid';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS, CVISION_COLLECTIONS } from '@/lib/cvision/constants';
import { createBudgetedPositionSchema, paginationSchema } from '@/lib/cvision/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Compute metrics for a budgeted position
 */
async function computePositionMetrics(
  tenantId: string,
  positionId: string
): Promise<{
  occupiedHeadcount: number;
  openRequisitions: number;
  availableSlots: number;
}> {
  const employeeCollection = await getCVisionCollection<CVisionEmployee>(
    tenantId,
    'employees'
  );
  
  const requisitionCollection = await getCVisionCollection<CVisionJobRequisition>(
    tenantId,
    'jobRequisitions'
  );

  // Count occupied headcount (ACTIVE + PROBATION employees)
  const occupiedCount = await employeeCollection.countDocuments(
    createTenantFilter(tenantId, {
      positionId,
      status: { $in: ['ACTIVE', 'PROBATION'] },
      isArchived: { $ne: true },
    })
  );

  // Count open requisitions
  const openReqsCount = await requisitionCollection.countDocuments(
    createTenantFilter(tenantId, {
      positionId,
      status: 'open',
      isArchived: { $ne: true },
    })
  );

  // Get position to get budgetedHeadcount
  const positionCollection = await getCVisionCollection<CVisionBudgetedPosition>(
    tenantId,
    'budgetedPositions'
  );
  const position = await positionCollection.findOne(
    createTenantFilter(tenantId, { id: positionId })
  );

  const budgetedHeadcount = position?.budgetedHeadcount || 0;
  const availableSlots = Math.max(0, budgetedHeadcount - occupiedCount - openReqsCount);

  return {
    occupiedHeadcount: occupiedCount,
    openRequisitions: openReqsCount,
    availableSlots,
  };
}

// GET - List budgeted positions with computed metrics
export const GET = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return NextResponse.json({ items: [], data: [] });
      }
      const ctx = ctxResult;

      // Enforce read permission
      const policyResult = canReadOrg(ctx);
      const enforceResult = await enforce(policyResult, request, ctx);
      if (enforceResult) {
        return NextResponse.json({ items: [], data: [] });
      }

      const { searchParams } = new URL(request.url);

      // ── Fix position codes (admin utility) ──────────────────
      const action = searchParams.get('action');
      if (action === 'fix-codes') {
        const collection = await getCVisionCollection<CVisionBudgetedPosition>(
          tenantId,
          'budgetedPositions'
        );
        const positions = await collection.find(createTenantFilter(tenantId, {})).limit(5000).toArray();
        const updates: { oldCode: string; newCode: string; title: string | null }[] = [];

        const jobTitleCol = await getCVisionCollection<CVisionJobTitle>(tenantId, 'jobTitles');
        const unitCol = await getCVisionCollection(tenantId, 'units');

        for (const pos of positions) {
          const oldCode = pos.positionCode;
          if (!oldCode) continue;

          const parts = oldCode.split('-');
          // Only fix codes that are too long (more than 4 parts: POS-LOC-JOB-SEQ)
          if (parts.length <= 4) continue;

          // Fetch related unit and job title for clean codes
          const jobTitle = pos.jobTitleId
            ? await jobTitleCol.findOne(createTenantFilter(tenantId, { id: pos.jobTitleId }))
            : null;

          const unit = pos.unitId
            ? await unitCol.findOne(createTenantFilter(tenantId, { id: pos.unitId }))
            : null;

          const unitCode = (unit as Record<string, unknown>)?.code || 'XX';
          const jobCode = (jobTitle as Record<string, unknown>)?.code || 'XX';
          const seq = parts[parts.length - 1]; // Last part is the sequence number

          const newCode = `POS-${unitCode}-${jobCode}-${seq}`;

          if (newCode !== oldCode) {
            await collection.updateOne(
              { tenantId, _id: pos._id },
              { $set: { positionCode: newCode, updatedAt: new Date() } }
            );
            updates.push({ oldCode, newCode, title: pos.title || null });
          }
        }

        return NextResponse.json({
          success: true,
          message: `Fixed ${updates.length} position codes`,
          updates,
        });
      }

      const departmentId = searchParams.get('departmentId');
      const jobTitleId = searchParams.get('jobTitleId');
      const includeInactive = searchParams.get('includeInactive') === '1';

      const params = paginationSchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
        search: searchParams.get('search'),
        sortBy: searchParams.get('sortBy') || 'positionCode',
        sortOrder: searchParams.get('sortOrder'),
      });

      const collection = await getCVisionCollection<CVisionBudgetedPosition>(
        tenantId,
        'budgetedPositions'
      );

      // Build filter
      const filter = createTenantFilter(tenantId, {});
      
      if (!includeInactive) {
        filter.isActive = true;
      }
      
      if (departmentId) {
        filter.departmentId = departmentId;
      }
      
      if (jobTitleId) {
        filter.jobTitleId = jobTitleId;
      }

      const unitId = searchParams.get('unitId');
      if (unitId) {
        filter.unitId = unitId;
      }

      // Apply search if provided
      if (params.search) {
        const escapedSearch = params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = { $regex: escapedSearch, $options: 'i' };
        filter.$or = [
          { positionCode: searchRegex },
          { title: searchRegex },
        ];
      }

      const result = await paginatedList<CVisionBudgetedPosition>(collection, tenantId, params, filter);

      // Compute metrics for each position
      const positionsWithMetrics = await Promise.all(
        result.data.map(async (position: CVisionBudgetedPosition) => {
          const metrics = await computePositionMetrics(tenantId, position.id);
          return {
            ...position,
            ...metrics,
          };
        })
      );

      // ── Enrich with job title & unit names for display ──────
      const jobTitleIds = [...new Set(positionsWithMetrics.map((p) => p.jobTitleId).filter(Boolean))];
      const unitIds = [...new Set(positionsWithMetrics.map((p) => p.unitId).filter(Boolean))];

      const jobTitleCol = await getCVisionCollection<CVisionJobTitle>(tenantId, 'jobTitles');
      const unitCol = await getCVisionCollection(tenantId, 'units');

      const jobTitles = jobTitleIds.length > 0
        ? await jobTitleCol.find(createTenantFilter(tenantId, { id: { $in: jobTitleIds } })).limit(5000).toArray()
        : [];
      const units = unitIds.length > 0
        ? await unitCol.find(createTenantFilter(tenantId, { id: { $in: unitIds } })).limit(5000).toArray()
        : [];

      const jtMap = new Map(jobTitles.map((jt) => [jt.id, jt]));
      const unitMap = new Map(units.map((u: any) => [u.id, u]));

      for (const pos of positionsWithMetrics as (CVisionBudgetedPosition & any)[]) {
        const jt = jtMap.get(pos.jobTitleId);
        const unit = pos.unitId ? unitMap.get(pos.unitId) : null;
        pos.jobTitleName = jt?.name || jt?.nameAr || null;
        pos.unitName = (unit as Record<string, unknown>)?.name || (unit as Record<string, unknown>)?.nameAr || null;
        pos.displayName = [jt?.name, unit?.name].filter(Boolean).join(' - ') || pos.title || pos.positionCode;
      }

      return NextResponse.json({
        success: true,
        items: positionsWithMetrics,
        data: positionsWithMetrics,
        total: result.total,
        page: result.page,
        limit: result.limit,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('[CVision Budgeted Positions GET]', errMsg);
      return NextResponse.json(
        { error: 'Internal server error', message: errMsg },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_READ }
);

// POST - Create budgeted position
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult;
      }
      const ctx = ctxResult;

      // Enforce write permission
      const policyResult = canWriteOrg(ctx);
      const enforceResult = await enforce(policyResult, request, ctx);
      if (enforceResult) {
        return enforceResult;
      }

      const body = await request.json();
      const data = createBudgetedPositionSchema.parse(body);

      // Validate department exists
      const departmentCollection = await getCVisionCollection(tenantId, 'departments');
      const department = await departmentCollection.findOne(
        createTenantFilter(tenantId, { id: data.departmentId })
      );
      if (!department) {
        return NextResponse.json(
          { error: 'Department not found', code: 'INVALID_DEPARTMENT' },
          { status: 400 }
        );
      }

      // Validate job title exists and belongs to department
      const jobTitleCollection = await getCVisionCollection<CVisionJobTitle>(tenantId, 'jobTitles');
      const jobTitle = await jobTitleCollection.findOne(
        createTenantFilter(tenantId, { id: data.jobTitleId })
      );
      if (!jobTitle) {
        return NextResponse.json(
          { error: 'Job title not found', code: 'INVALID_JOB_TITLE' },
          { status: 400 }
        );
      }
      if (jobTitle.departmentId && jobTitle.departmentId !== data.departmentId) {
        return NextResponse.json(
          { error: 'Job title does not belong to selected department', code: 'JOB_TITLE_DEPARTMENT_MISMATCH' },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionBudgetedPosition>(
        tenantId,
        'budgetedPositions'
      );

      // Resolve unit if the job title has a unitId
      let unitCode: string | null = null;
      const resolvedUnitId = data.unitId || (jobTitle as Record<string, unknown>).unitId as string || null;
      if (resolvedUnitId) {
        const unitCollection = await getCVisionCollection(tenantId, 'units');
        const unit = await unitCollection.findOne(
          createTenantFilter(tenantId, { id: resolvedUnitId })
        );
        if (unit) {
          unitCode = (unit as Record<string, unknown>).code as string || null;
        }
      }

      // Auto-generate positionCode if not provided
      let positionCode = data.positionCode;
      if (!positionCode) {
        // Format: POS-{UNIT_CODE}-{JOB_CODE}-{SEQ} or POS-{DEPT_CODE}-{JOB_CODE}-{SEQ}
        const deptCode = (department as Record<string, unknown>).code || 'DEPT';
        const jobCode = (jobTitle as Record<string, unknown>).code || 'JOB';
        // Prefer unit code over department code for shorter, cleaner codes
        const locationCode = unitCode || deptCode;
        const seqPrefix = `POS-${locationCode}-${jobCode}`;
        const db = await getCVisionDb(tenantId);
        const seqCollection = db.collection('cvision_sequences');
        const seqResult = await seqCollection.findOneAndUpdate(
          { tenantId, entityType: seqPrefix },
          {
            $inc: { currentValue: 1 },
            $setOnInsert: { prefix: seqPrefix, entityType: seqPrefix },
          },
          { upsert: true, returnDocument: 'after' }
        );
        // Extract integer from PrismaShim document result
        const seqDoc = seqResult?.value;
        const seqValue = (typeof seqDoc === 'object' && seqDoc !== null)
          ? (seqDoc.currentValue ?? seqDoc.value ?? 1)
          : (seqDoc || 1);
        const seq = String(seqValue).padStart(3, '0');
        positionCode = `${seqPrefix}-${seq}`;
      }

      // Check uniqueness of positionCode
      const existing = await collection.findOne(
        createTenantFilter(tenantId, { positionCode })
      );
      if (existing) {
        return NextResponse.json(
          { 
            error: 'Position code already exists', 
            code: 'DUPLICATE_POSITION_CODE',
            details: {
              existingPositionId: existing.id,
              existingPositionTitle: existing.title || positionCode,
            },
          },
          { status: 400 }
        );
      }

      const now = new Date();
      // Validate grade if provided
      if (data.gradeId) {
        const gradeCollection = await getCVisionCollection(tenantId, 'grades');
        const grade = await gradeCollection.findOne(
          createTenantFilter(tenantId, { id: data.gradeId })
        );
        if (!grade) {
          return NextResponse.json(
            { error: 'Grade not found', code: 'INVALID_GRADE' },
            { status: 400 }
          );
        }
      }

      // Only include fields that exist as columns in cvision_budgeted_positions PG table.
      // PG columns: id, tenantId, positionCode, title (NOT NULL), departmentId, unitId,
      // jobTitleId, gradeId, budgetedHeadcount, isActive, createdAt, updatedAt,
      // createdBy, updatedBy, deletedAt
      // IMPORTANT: title is NOT NULL in PG — always provide a value
      const position: CVisionBudgetedPosition = {
        id: uuidv4(),
        tenantId,
        positionCode,
        title: data.title || positionCode, // title is NOT NULL in PG; fall back to positionCode
        departmentId: data.departmentId,
        unitId: resolvedUnitId,
        jobTitleId: data.jobTitleId,
        gradeId: data.gradeId || null,
        budgetedHeadcount: data.budgetedHeadcount,
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
        deletedAt: null,
      };

      await collection.insertOne(position);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'budgeted_position_create',
        'budgeted_position',
        {
          resourceId: position.id,
          metadata: {
            positionCode: position.positionCode,
            departmentId: position.departmentId,
            jobTitleId: position.jobTitleId,
            budgetedHeadcount: position.budgetedHeadcount,
          },
        }
      );

      // Compute metrics for response
      const metrics = await computePositionMetrics(tenantId, position.id);

      return NextResponse.json({
        success: true,
        position: {
          ...position,
          ...metrics,
        },
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('[CVision Budgeted Positions POST]', errMsg);
      return NextResponse.json(
        { error: 'Internal server error', message: errMsg },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_WRITE }
);
