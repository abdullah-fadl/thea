import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Job Titles API
 * GET /api/cvision/job-titles - List job titles
 * POST /api/cvision/job-titles - Create job title
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  paginatedList,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import {
  createJobTitleSchema,
  paginationSchema,
} from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionJobTitle } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs'; // Ensure Node.js runtime (not Edge)

// GET - List job titles
export const GET = withAuthTenant(
  async (request, { tenantId }) => {
    logger.info('[CVision Job Titles GET] Handler called', { tenantId, url: request.url });
    try {
      const { searchParams } = new URL(request.url);

      // ── Normalize all job titles across collections ──
      if (searchParams.get('action') === 'normalize-titles') {
        const TITLE_MAP: Record<string, string> = {
          'rn': 'Registered Nurse',
          'lpn': 'Licensed Practical Nurse',
          'swe': 'Software Engineer',
          'sr-swe': 'Senior Software Engineer',
          'data analyst': 'Data Analyst',
          'hr manager': 'HR Manager',
          'hr coordinator': 'HR Coordinator',
          'it manager': 'IT Manager',
          'accountant': 'Accountant',
          'finance manager': 'Finance Manager',
          'hr specialist': 'HR Specialist',
          'head nurse': 'Head Nurse',
          'staff nurse': 'Staff Nurse',
          'nurse': 'Registered Nurse',
        };

        function normalizeTitle(t: string): string {
          if (!t) return t;
          const key = t.toLowerCase().trim();
          if (TITLE_MAP[key]) return TITLE_MAP[key];
          if (key === t) return t.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          return t;
        }

        const results: Record<string, number> = {};

        // 1. Fix cvision_job_requisitions
        const reqCol = await getCVisionCollection(tenantId, 'jobRequisitions');
        const reqs = await reqCol.find({ tenantId }).limit(5000).toArray();
        let reqFixed = 0;
        for (const r of reqs) {
          const oldTitle = (r as Record<string, unknown>).title as string || '';
          const newTitle = normalizeTitle(oldTitle);
          if (newTitle !== oldTitle) {
            await reqCol.updateOne({ _id: r._id, tenantId }, {
              $set: {
                title: newTitle,
                jobTitleName: normalizeTitle((r as Record<string, unknown>).jobTitleName as string || newTitle),
                description: `We are looking for a ${newTitle} to join our team.`,
                updatedAt: new Date(),
              },
            });
            reqFixed++;
          }
        }
        results['requisitions'] = reqFixed;

        // 2. Fix cvision_budgeted_positions
        const posCol = await getCVisionCollection(tenantId, 'budgetedPositions');
        const positions = await posCol.find({ tenantId }).limit(5000).toArray();
        let posFixed = 0;
        for (const p of positions) {
          const pRec = p as Record<string, unknown>;
          const oldTitle = pRec.jobTitleName as string || pRec.title as string || '';
          const newTitle = normalizeTitle(oldTitle);
          if (newTitle !== oldTitle) {
            const updates: any = { updatedAt: new Date() };
            if (pRec.jobTitleName) updates.jobTitleName = newTitle;
            if (pRec.title) updates.title = newTitle;
            await posCol.updateOne({ _id: p._id, tenantId }, { $set: updates });
            posFixed++;
          }
        }
        results['positions'] = posFixed;

        // 3. Fix cvision_job_titles
        const jtCol = await getCVisionCollection<CVisionJobTitle>(tenantId, 'jobTitles');
        const jts = await jtCol.find({ tenantId, deletedAt: null }).limit(5000).toArray();
        let jtFixed = 0;
        for (const jt of jts) {
          const oldName = jt.name || '';
          const newName = normalizeTitle(oldName);
          if (newName !== oldName) {
            await jtCol.updateOne({ _id: (jt as Record<string, unknown>)._id, tenantId }, { $set: { name: newName, updatedAt: new Date() } });
            jtFixed++;
          }
        }
        results['jobTitles'] = jtFixed;

        return NextResponse.json({
          success: true,
          message: `Normalized titles: ${reqFixed} requisitions, ${posFixed} positions, ${jtFixed} job titles`,
          results,
        });
      }

      // ── Fix prefixed codes: strip department-code prefix from job title codes ──
      if (searchParams.get('action') === 'fix-codes') {
        const db_collections = await getCVisionCollection<CVisionJobTitle>(tenantId, 'jobTitles');
        const deptCollection = await getCVisionCollection(tenantId, 'departments');
        const depts = await deptCollection.find({ tenantId, deletedAt: null }).limit(500).toArray();
        const deptCodeMap = new Map(depts.map((d) => [d.id, ((d as Record<string, unknown>).code as string || '').toUpperCase()]));

        const allJobs = await db_collections.find({ tenantId, deletedAt: null }).limit(500).toArray();
        let fixed = 0;
        const details: any[] = [];

        for (const jt of allJobs) {
          const deptPrefix = deptCodeMap.get(jt.departmentId);
          if (deptPrefix && jt.code.toUpperCase().startsWith(`${deptPrefix}-`)) {
            const cleanCode = jt.code.substring(deptPrefix.length + 1);
            await db_collections.updateOne(
              { _id: (jt as Record<string, unknown>)._id, tenantId },
              { $set: { code: cleanCode, updatedAt: new Date() } }
            );
            details.push({ id: jt.id, oldCode: jt.code, newCode: cleanCode, dept: deptPrefix });
            fixed++;
          }
        }

        return NextResponse.json({
          success: true,
          message: `Fixed ${fixed} job title codes out of ${allJobs.length} total`,
          fixed,
          total: allJobs.length,
          details,
        });
      }

      let params;
      try {
        params = paginationSchema.parse({
          page: searchParams.get('page'),
          limit: searchParams.get('limit'),
          search: searchParams.get('search'),
          sortBy: searchParams.get('sortBy') || 'name',
          sortOrder: searchParams.get('sortOrder'),
          includeDeleted: searchParams.get('includeDeleted'),
        });
      } catch (parseError: unknown) {
        const pe = parseError as Record<string, unknown>;
        logger.error('[CVision Job Titles GET] Pagination parse error:', pe?.errors || pe?.message);
        return NextResponse.json(
          {
            error: 'Invalid pagination parameters',
            code: 'VALIDATION_ERROR',
            details: pe?.errors || pe?.message
          },
          { status: 400 }
        );
      }

      // Get collection with error handling
      let collection;
      try {
        collection = await getCVisionCollection<CVisionJobTitle>(
          tenantId,
          'jobTitles'
        );
      } catch (dbError: unknown) {
        const dbe = dbError as Record<string, unknown>;
        logger.error('[CVision Job Titles GET] Failed to get collection', {
          tenantId,
          error: dbe.message || String(dbError),
          stack: dbe.stack,
        });
        return NextResponse.json(
          {
            error: dbe.message || 'Failed to connect to database',
            code: 'DATABASE_ERROR'
          },
          { status: 500 }
        );
      }

      const isActiveFilter = searchParams.get('isActive');
      const departmentId = searchParams.get('departmentId');
      const departmentParam = searchParams.get('department'); // Legacy support
      const additionalFilter: any = {};
      
      if (isActiveFilter !== null) {
        additionalFilter.isActive = isActiveFilter === 'true';
      }
      
      // Handle departmentId (preferred) or department (legacy)
      let finalDepartmentId: string | null = null;
      if (departmentId) {
        // departmentId is preferred - use it directly
        finalDepartmentId = departmentId;
      } else if (departmentParam) {
        // Legacy: department param - only use if it looks like a UUID (valid ID)
        // UUID format: 8-4-4-4-12 hex characters
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(departmentParam)) {
          finalDepartmentId = departmentParam;
        } else {
          // If department param is not a valid UUID, ignore it (don't filter)
          logger.warn('[CVision Job Titles GET] Ignoring invalid department param (not a UUID):', departmentParam);
        }
      }
      
      if (finalDepartmentId) {
        additionalFilter.departmentId = finalDepartmentId;
      }

      // Filter by unitId
      const unitId = searchParams.get('unitId');
      if (unitId) {
        additionalFilter.unitId = unitId;
      }

      logger.info('[CVision Job Titles GET] Request:', {
        tenantId,
        departmentId,
        departmentParam,
        finalDepartmentId,
        isActiveFilter,
        filter: additionalFilter,
        hasAdditionalFilter: Object.keys(additionalFilter).length > 0,
      });

      // Execute paginated query with error handling
      let result;
      try {
        const filterToUse = Object.keys(additionalFilter).length > 0 ? additionalFilter : undefined;
        logger.info('[CVision Job Titles GET] Calling paginatedList', {
          tenantId,
          filter: filterToUse,
        });
        
        result = await paginatedList(
          collection,
          tenantId,
          params,
          filterToUse
        );
        
        logger.info('[CVision Job Titles GET] paginatedList succeeded', {
          tenantId,
          count: result.data?.length || 0,
          total: result.total,
        });
      } catch (dbError: unknown) {
        const dbe = dbError as Record<string, unknown>;
        logger.error('[CVision Job Titles GET] Database query error', {
          tenantId,
          departmentId,
          error: dbe.message || String(dbError),
          stack: dbe.stack,
          filter: additionalFilter,
          errorName: dbe.name,
          errorCode: dbe.code,
        });
        return NextResponse.json(
          {
            error: dbe.message || 'Failed to query job titles',
            code: 'DATABASE_ERROR',
            details: process.env.NODE_ENV === 'development' ? {
              stack: dbe.stack,
              name: dbe.name,
              code: dbe.code,
            } : undefined,
          },
          { status: 500 }
        );
      }

      const jobTitlesData = result.data || [];
      
      logger.info('[CVision Job Titles GET] Result:', {
        tenantId,
        departmentId,
        count: jobTitlesData.length,
        total: result.total || 0,
        filter: additionalFilter,
        jobTitles: jobTitlesData.slice(0, 5).map((jt) => ({
          id: jt.id,
          name: jt.name,
          departmentId: jt.departmentId,
        })),
      });

      // Return consistent response shape: { items: [...], total: n }
      return NextResponse.json({
        items: jobTitlesData,
        total: result.total || 0,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error: unknown) {
      const err = error as Record<string, unknown>;
      logger.error('[CVision Job Titles GET] Unexpected error:', err?.message || String(error), err?.stack);
      return NextResponse.json(
        {
          error: err.message || 'Internal server error',
          code: 'INTERNAL_ERROR'
        },
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_READ }
);

// POST - Create job title
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      
      // Validate departmentId is provided (required field)
      if (!body.departmentId) {
        return NextResponse.json(
          { 
            error: 'departmentId is required',
            code: 'VALIDATION_ERROR',
            details: [{ path: ['departmentId'], message: 'departmentId is required' }],
          },
          { 
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }
      
      const data = createJobTitleSchema.parse(body);

      // PR-A: Validate departmentId exists and belongs to tenant
      const deptCollection = await getCVisionCollection(tenantId, 'departments');
      const department = await deptCollection.findOne(
        createTenantFilter(tenantId, { id: data.departmentId })
      );
      if (!department) {
        return NextResponse.json(
          { 
            error: 'Department not found or does not belong to tenant',
            code: 'DEPARTMENT_NOT_FOUND'
          },
          { 
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const collection = await getCVisionCollection<CVisionJobTitle>(
        tenantId,
        'jobTitles'
      );

      // Check for existing job title with same code within the same department
      // Same code (e.g., "SN") is allowed in different departments
      // The full position code (POS-NS-SN-001) is generated in budgeted-positions
      const existingFilter: any = {
        tenantId,
        code: data.code,
        departmentId: data.departmentId,
        $or: [
          { deletedAt: null },
          { deletedAt: { $exists: false } },
        ],
      };
      const existing = await collection.findOne(existingFilter);

      if (existing) {
        const existingName = existing.name || 'Unknown';
        const isDeleted = !!existing.deletedAt;

        return NextResponse.json(
          {
            error: isDeleted
              ? `A deleted job title "${existingName}" uses code "${data.code}" in this department. Use a different code or restore the existing one.`
              : `Job title "${existingName}" already uses code "${data.code}" in this department.`,
            details: {
              existingName,
              isDeleted,
              departmentId: existing.departmentId,
            }
          },
          { status: 400 }
        );
      }

      const now = new Date();
      // Only include fields that exist as columns in cvision_job_titles PG table.
      // PG columns: id, tenantId, code, name, nameAr, description, departmentId,
      // unitId, gradeId, isActive, isArchived, requirements, responsibilities,
      // createdAt, updatedAt, createdBy, updatedBy, deletedAt
      const jobTitle: CVisionJobTitle = {
        id: uuidv4(),
        tenantId,
        code: data.code,
        name: data.name,
        nameAr: data.nameAr || null,
        description: data.description || null,
        departmentId: data.departmentId,
        unitId: data.unitId || null,
        gradeId: data.gradeId || null,
        isActive: data.isActive ?? true,
        isArchived: false,
        requirements: data.requirements || null,
        responsibilities: data.responsibilities || null,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
        deletedAt: null,
      };

      const insertResult = await collection.insertOne(jobTitle);

      // PrismaShim returns acknowledged:false when the INSERT fails silently
      // (e.g. unique constraint violation on (tenantId, code) at the PG level).
      if (!insertResult.acknowledged) {
        logger.error('[CVision Job Titles POST] insertOne failed (acknowledged:false)', {
          tenantId, code: data.code, departmentId: data.departmentId,
        });
        // Try to find the existing record that caused the conflict
        const conflicting = await collection.findOne(
          createTenantFilter(tenantId, { code: data.code })
        );
        if (conflicting) {
          return NextResponse.json(
            {
              error: `Job title code "${data.code}" already exists in tenant (used by "${conflicting.name}" in another department). Use a unique code.`,
              code: 'CODE_ALREADY_EXISTS',
              details: {
                existingId: conflicting.id,
                existingName: conflicting.name,
                existingDepartmentId: conflicting.departmentId,
              },
            },
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return NextResponse.json(
          { error: 'Failed to create job title (database insert failed)', code: 'INSERT_FAILED' },
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'job_title_create',
        'job_title',
        { resourceId: jobTitle.id, changes: { after: data } }
      );

      return NextResponse.json(
        { success: true, jobTitle },
        { 
          status: 201,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error: unknown) {
      const err = error as Record<string, unknown>;
      if (err.name === 'ZodError') {
        return NextResponse.json(
          {
            error: 'Validation error',
            code: 'VALIDATION_ERROR',
            details: err.errors
          },
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }
      logger.error('[CVision Job Titles POST]', err?.message || String(error), err?.stack);
      return NextResponse.json(
        {
          error: err.message || 'Internal server error',
          code: 'INTERNAL_ERROR'
        },
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.CONFIG_WRITE }
);

