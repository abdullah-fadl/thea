import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Departments API
 * GET /api/cvision/departments - List departments
 * POST /api/cvision/departments - Create department
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  paginatedList,
  isCodeUnique,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import {
  createDepartmentSchema,
  paginationSchema,
} from '@/lib/cvision/validation';
import { CVISION_COLLECTIONS, CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionDepartment } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - List departments
export const GET = withAuthTenant(
  async (request, { tenantId, userId, role }) => {
    try {
      const { searchParams } = new URL(request.url);
      const params = paginationSchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
        search: searchParams.get('search'),
        sortBy: searchParams.get('sortBy') || 'name',
        sortOrder: searchParams.get('sortOrder'),
        includeDeleted: searchParams.get('includeDeleted'),
      });

      const collection = await getCVisionCollection<CVisionDepartment>(
        tenantId,
        'departments'
      );

      // Additional filter for active only (optional)
      const isActiveFilter = searchParams.get('isActive');
      const additionalFilter = isActiveFilter !== null
        ? { isActive: isActiveFilter === 'true' }
        : undefined;

      const result = await paginatedList(collection, tenantId, params, additionalFilter);

      return NextResponse.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      logger.error('[CVision Departments GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error?.message || 'Unknown error' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_READ }
);

// POST - Create department
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const data = createDepartmentSchema.parse(body);

      const collection = await getCVisionCollection<CVisionDepartment>(
        tenantId,
        'departments'
      );

      // Check code uniqueness
      const isUnique = await isCodeUnique(collection, tenantId, data.code);
      if (!isUnique) {
        return NextResponse.json(
          { error: 'Department code already exists' },
          { status: 400 }
        );
      }

      // Validate parentId if provided
      if (data.parentId) {
        const parent = await collection.findOne(
          createTenantFilter(tenantId, { id: data.parentId })
        );
        if (!parent) {
          return NextResponse.json(
            { error: 'Parent department not found' },
            { status: 400 }
          );
        }
      }

      const now = new Date();
      const department: CVisionDepartment = {
        id: uuidv4(),
        tenantId,
        code: data.code,
        name: data.name,
        nameAr: data.nameAr,
        description: data.description,
        parentId: data.parentId,
        managerId: data.managerId,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      await collection.insertOne(department);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'department_create',
        'department',
        { resourceId: department.id, changes: { after: data } }
      );

      return NextResponse.json(
        { success: true, department },
        { status: 201 }
      );
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Departments POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_WRITE }
);
