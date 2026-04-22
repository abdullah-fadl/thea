import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Department by ID API
 * GET /api/cvision/departments/[id] - Get department
 * PUT /api/cvision/departments/[id] - Update department
 * DELETE /api/cvision/departments/[id] - Archive department (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  findById,
  softDelete,
  isCodeUnique,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
  computeChanges,
} from '@/lib/cvision/audit';
import { updateDepartmentSchema } from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionDepartment } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get department by ID
export const GET = withAuthTenant(
  async (request, { tenantId }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Department ID is required' },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionDepartment>(
        tenantId,
        'departments'
      );

      const department = await findById(collection, tenantId, id);

      if (!department) {
        return NextResponse.json(
          { error: 'Department not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, department });
    } catch (error: any) {
      logger.error('[CVision Department GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_READ }
);

// PUT - Update department
export const PUT = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Department ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = updateDepartmentSchema.parse(body);

      const collection = await getCVisionCollection<CVisionDepartment>(
        tenantId,
        'departments'
      );

      const existing = await findById(collection, tenantId, id);
      if (!existing) {
        return NextResponse.json(
          { error: 'Department not found' },
          { status: 404 }
        );
      }

      // Check code uniqueness if changing
      if (data.code && data.code !== existing.code) {
        const isUnique = await isCodeUnique(collection, tenantId, data.code, id);
        if (!isUnique) {
          return NextResponse.json(
            { error: 'Department code already exists' },
            { status: 400 }
          );
        }
      }

      // Validate parentId if provided (prevent circular reference)
      if (data.parentId) {
        if (data.parentId === id) {
          return NextResponse.json(
            { error: 'Department cannot be its own parent' },
            { status: 400 }
          );
        }
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

      const updateData = {
        ...data,
        updatedAt: new Date(),
        updatedBy: userId,
      };

      await collection.updateOne(
        createTenantFilter(tenantId, { id }),
        { $set: updateData }
      );

      const updated = await findById(collection, tenantId, id);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'department_update',
        'department',
        {
          resourceId: id,
          changes: computeChanges(existing, updated!),
        }
      );

      return NextResponse.json({ success: true, department: updated });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Department PUT]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_WRITE }
);

// PATCH - Alias for PUT (REST compliance)
export const PATCH = PUT;

// DELETE - Archive department (soft delete)
export const DELETE = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Department ID is required' },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionDepartment>(
        tenantId,
        'departments'
      );

      const existing = await findById(collection, tenantId, id);
      if (!existing) {
        return NextResponse.json(
          { error: 'Department not found' },
          { status: 404 }
        );
      }

      // Check for child departments
      const hasChildren = await collection.findOne(
        createTenantFilter(tenantId, { parentId: id })
      );
      if (hasChildren) {
        return NextResponse.json(
          { error: 'Cannot archive department with child departments' },
          { status: 400 }
        );
      }

      const success = await softDelete(collection, tenantId, id, userId);

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to archive department' },
          { status: 500 }
        );
      }

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'department_archive',
        'department',
        { resourceId: id }
      );

      return NextResponse.json({ success: true });
    } catch (error: any) {
      logger.error('[CVision Department DELETE]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_WRITE }
);
