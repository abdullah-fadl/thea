import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRoleAsync, getAuthContext } from '@/lib/auth/requireRole';
import * as structureService from '@/lib/services/structureService';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

const updateFloorSchema = z.object({
  number: z.string().min(1).optional(),
  name: z.string().optional(),
  label_en: z.string().min(1).optional(),
  label_ar: z.string().min(1).optional(),
});

// GET - Get floor by ID
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff', 'viewer']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const floor = await structureService.getFloorById(params.id);
    if (!floor) {
      return NextResponse.json({ error: 'Floor not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: floor });
});

// PUT - Update floor
export const PUT = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
    // Use requireRoleAsync which returns role directly from token/headers (no DB lookup needed)
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // authResult.userRole is already available from token/headers - no need to read from DB
    const userRole = authResult.userRole;
    const userId = authResult.userId;

    // Allow if user has admin role (admin role has full access)
    if (userRole !== 'admin') {
      // For non-admin roles, check permissions
      const user = await prisma.user.findFirst({ where: { id: userId } });
      const userPermissions = user?.permissions || [];

      const hasPermission =
        userPermissions.includes('admin.structure-management.edit') ||
        userPermissions.includes('admin.users') ||
        userPermissions.some((p: string) => p.startsWith('admin.'));

      if (!hasPermission) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions. Admin role or admin.structure-management.edit permission required.' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const v = validateBody(body, updateFloorSchema);
    if ('error' in v) return v.error;
    const validatedData = v.data;

    const floor = await structureService.updateFloor(params.id, {
      ...validatedData,
      updatedBy: userId,
    });

    if (!floor) {
      return NextResponse.json({ error: 'Floor not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: floor });
});

// DELETE - Delete floor (hard delete)
export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
    // Use requireRoleAsync which returns role directly from token/headers (no DB lookup needed)
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // authResult.userRole is already available from token/headers - no need to read from DB
    const userRole = authResult.userRole;
    const userId = authResult.userId;

    // Allow if user has admin role (admin role has full access)
    if (userRole !== 'admin') {
      // For non-admin roles, check permissions
      const user = await prisma.user.findFirst({ where: { id: userId } });
      const userPermissions = user?.permissions || [];

      const hasPermission =
        userPermissions.includes('admin.structure-management.delete') ||
        userPermissions.includes('admin.users') ||
        userPermissions.some((p: string) => p.startsWith('admin.'));

      if (!hasPermission) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient permissions. Admin role or admin.structure-management.delete permission required.' },
          { status: 403 }
        );
      }
    }

    // CRITICAL: HARD DELETE (remove completely, not soft delete)
    const success = await structureService.deleteFloor(params.id, userId, true); // hardDelete = true

    // Also try to delete from org_nodes if it exists there
    try {
      const { deleteOrgNode } = await import('@/lib/core/org/structure');
      const deleteResult = await deleteOrgNode(request, params.id, undefined, true); // forceDelete = true
      if (deleteResult instanceof NextResponse && deleteResult.status !== 200) {
        logger.warn('Failed to delete org node for floor', { category: 'api', route: 'DELETE /api/structure/floors/[id]', floorId: params.id, status: deleteResult.status });
        // Don't fail the request - floor is already deleted from floors collection
      }
    } catch (orgError) {
      logger.error('Error deleting org node for floor', { category: 'api', route: 'DELETE /api/structure/floors/[id]', floorId: params.id, error: orgError });
      // Don't fail the request - floor is already deleted from floors collection
    }

    if (!success) {
      return NextResponse.json({ error: 'Floor not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
});
