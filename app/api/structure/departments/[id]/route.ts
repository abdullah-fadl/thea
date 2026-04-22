import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import * as structureService from '@/lib/services/structureService';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

const updateDepartmentSchema = z.object({
  floorKey: z.string().min(1).optional(),
  departmentKey: z.string().min(1).optional(),
  departmentName: z.string().optional(),
  label_en: z.string().min(1).optional(),
  label_ar: z.string().min(1).optional(),
});

// GET - Get department by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const departmentId = resolvedParams.id;

      // Get all departments with tenant isolation
      const departments = await structureService.getAllDepartments(tenantId);
      const department = departments.find(d => d.id === departmentId);

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: department });
  } catch (error: any) {
    logger.error('Error fetching department', { category: 'api', route: 'GET /api/structure/departments/[id]', error });
    return NextResponse.json(
      { error: 'Failed to fetch department' },
      { status: 500 }
    );
    }
  }, { tenantScoped: true, permissionKey: 'structure.departments.read' })(request);
}

// PUT - Update department
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
    try {
      // Check permission: admin.structure-management.edit
      if (
        !permissions.includes('admin.structure-management.edit') &&
        !permissions.includes('admin.users') &&
        !['admin', 'supervisor'].includes(role)
      ) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions' },
          { status: 403 }
        );
      }

      const resolvedParams = params instanceof Promise ? await params : params;
      const departmentId = resolvedParams.id;
      const body = await req.json();
      const v = validateBody(body, updateDepartmentSchema);
      if ('error' in v) return v.error;
      const validatedData = v.data;

      const department = await structureService.updateDepartment(departmentId, {
        ...validatedData,
        updatedBy: userId,
      }, tenantId);

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: department });
  } catch (error: any) {
    logger.error('Error updating department', { category: 'api', route: 'PUT /api/structure/departments/[id]', error });
    return NextResponse.json(
      { error: 'Failed to update department' },
      { status: 500 }
    );
    }
  }, { tenantScoped: true, permissionKey: 'structure.departments.update' })(request);
}

// DELETE - Delete department (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId, userId, role, permissions }) => {
    try {
      // Check permission: admin.structure-management.delete
      if (
        !permissions.includes('admin.structure-management.delete') &&
        !permissions.includes('admin.users') &&
        !['admin', 'supervisor'].includes(role)
      ) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions' },
          { status: 403 }
        );
      }

      const resolvedParams = params instanceof Promise ? await params : params;
      const departmentId = resolvedParams.id;
      
      // CRITICAL: HARD DELETE from both sources (not soft delete)
      // 1. floor_departments collection - HARD DELETE (remove completely)
      const success = await structureService.deleteDepartment(departmentId, userId, tenantId, true); // hardDelete = true
      if (!success) {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      }
      
      // 2. org_nodes collection (Structure Management) - HARD DELETE to prevent stale data
      try {
        const { deleteOrgNode } = await import('@/lib/core/org/structure');
        const deleteResult = await deleteOrgNode(req, departmentId, undefined, true); // forceDelete = true
        if (deleteResult instanceof NextResponse && deleteResult.status !== 200) {
          logger.warn('Failed to delete org node for department', { category: 'api', route: 'DELETE /api/structure/departments/[id]', departmentId, status: deleteResult.status });
          // Don't fail the request - department is already deleted from floor_departments
        } else {
          logger.info('Successfully deleted org node for department', { category: 'api', route: 'DELETE /api/structure/departments/[id]', departmentId });
        }
      } catch (orgDeleteError) {
        logger.error('Error deleting org node for department', { category: 'api', route: 'DELETE /api/structure/departments/[id]', departmentId, error: orgDeleteError });
        // Don't fail the request - department is already deleted from floor_departments
      }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting department', { category: 'api', route: 'DELETE /api/structure/departments/[id]', error });
    return NextResponse.json(
      { error: 'Failed to delete department' },
      { status: 500 }
    );
    }
  }, { tenantScoped: true, permissionKey: 'structure.departments.delete' })(request);
}


