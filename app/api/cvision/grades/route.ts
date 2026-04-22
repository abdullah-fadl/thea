import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Grades API
 * GET /api/cvision/grades - List grades
 * POST /api/cvision/grades - Create grade
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  paginatedList,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import {
  createGradeSchema,
  paginationSchema,
} from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionGrade } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - List grades
export const GET = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const params = paginationSchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
        search: searchParams.get('search'),
        sortBy: searchParams.get('sortBy') || 'level',
        sortOrder: searchParams.get('sortOrder') || 'asc',
        includeDeleted: searchParams.get('includeDeleted'),
      });

      const collection = await getCVisionCollection<CVisionGrade>(
        tenantId,
        'grades'
      );

      const isActiveFilter = searchParams.get('isActive');
      const jobTitleId = searchParams.get('jobTitleId');
      const additionalFilter: Record<string, any> = {};
      
      if (isActiveFilter !== null) {
        additionalFilter.isActive = isActiveFilter === 'true';
      }
      if (jobTitleId) {
        additionalFilter.jobTitleId = jobTitleId;
      }

      const result = await paginatedList(
        collection,
        tenantId,
        params,
        Object.keys(additionalFilter).length > 0 ? additionalFilter : undefined
      );

      return NextResponse.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      logger.error('[CVision Grades GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_READ }
);

// POST - Create grade
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const data = createGradeSchema.parse(body);

      const collection = await getCVisionCollection<CVisionGrade>(
        tenantId,
        'grades'
      );

      // Check for existing grade with same code (including archived ones)
      // We need to check ALL records, not just non-archived ones
      const existingFilter: any = {
        tenantId,
        code: data.code,
        // Include archived records in uniqueness check
        $or: [
          { deletedAt: null },
          { deletedAt: { $exists: false } },
        ],
      };
      const existing = await collection.findOne(existingFilter);
      
      if (existing) {
        // Provide more helpful error message
        const existingName = existing.name || 'Unknown';
        const isDeleted = !!existing.deletedAt;

        return NextResponse.json(
          {
            error: `Grade code "${data.code}" already exists`,
            details: {
              existingName,
              isDeleted,
              message: isDeleted
                ? `A deleted grade "${existingName}" uses this code. Please use a different code or restore the existing one.`
                : `Grade "${existingName}" already uses code "${data.code}". Please use a different code.`
            }
          },
          { status: 400 }
        );
      }

      const now = new Date();

      // NOTE: jobTitleId and jobTitleIds are NOT columns in the PostgreSQL
      // cvision_grades table. Including them would cause the INSERT to fail
      // silently. Grade-to-job-title relationships are managed via the
      // cvision_job_titles table's gradeId column instead.
      const grade: CVisionGrade = {
        id: uuidv4(),
        tenantId,
        code: data.code,
        name: data.name,
        nameAr: data.nameAr,
        description: data.description,
        level: data.level ?? 0,
        minSalary: data.minSalary,
        maxSalary: data.maxSalary,
        currency: data.currency,
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      await collection.insertOne(grade);

      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'grade_create',
        'grade',
        { resourceId: grade.id, changes: { after: data } }
      );

      return NextResponse.json(
        { success: true, grade },
        { status: 201 }
      );
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Grades POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.CONFIG_WRITE }
);
