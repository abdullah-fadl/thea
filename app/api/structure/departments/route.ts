import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRoleAsync, getAuthContext } from '@/lib/auth/requireRole';
import * as structureService from '@/lib/services/structureService';
import { prisma } from '@/lib/db/prisma';
import type { OrgNode } from '@/lib/core/models/OrganizationalStructure';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { cached } from '@/lib/cache';
import { CacheKeys, CacheTTL } from '@/lib/cache/keys';
import { invalidateOnDepartmentChange } from '@/lib/cache/invalidation';

export const dynamic = 'force-dynamic';

const createDepartmentSchema = z.object({
  floorId: z.string().optional(), // CRITICAL: Floor is now optional
  floorKey: z.string().optional(), // CRITICAL: Floor is now optional
  departmentKey: z.string().min(1),
  departmentName: z.string().optional(),
  label_en: z.string().min(1),
  label_ar: z.string().min(1),
});

// GET - List departments (optionally filtered by floorKey)
export const GET = withErrorHandler(async (request: NextRequest) => {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff', 'viewer']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // GOLDEN RULE: tenantId must ALWAYS come from session
    const { requireTenantId } = await import('@/lib/tenant');
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;

    const { searchParams } = new URL(request.url);
    const floorKey = searchParams.get('floorKey');
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    // Service layer now accepts tenantId parameter
    let departments;
    if (includeDeleted) {
      // CRITICAL ARCHITECTURAL RULE: Read departments from Prisma
      departments = await cached(
        CacheKeys.departmentsWithDeleted(tenantId),
        async () => {
          // Resolve tenantId UUID from tenant key
          const tenant = await prisma.tenant.findFirst({ where: { tenantId } });
          if (!tenant) return [];

          const raw = await prisma.floorDepartment.findMany({
            where: { tenantId: tenant.id },
            orderBy: { createdAt: 'asc' },
          });

          return raw.map((dept: any) => ({
            id: dept.id,
            floorId: dept.floorId,
            departmentId: dept.departmentId,
            departmentKey: dept.departmentCode,
            departmentName: dept.departmentName,
            key: dept.departmentCode,
            label_en: dept.departmentName || '',
            label_ar: dept.departmentName || '',
            active: dept.isActive !== false,
            createdAt: dept.createdAt,
          }));
        },
        CacheTTL.DEPARTMENTS,
      );
    } else if (floorKey) {
      departments = await cached(
        CacheKeys.departmentsByFloor(tenantId, floorKey),
        () => structureService.getDepartmentsByFloor(floorKey, tenantId),
        CacheTTL.DEPARTMENTS,
      );
    } else {
      departments = await cached(
        CacheKeys.departments(tenantId),
        () => structureService.getAllDepartments(tenantId),
        CacheTTL.DEPARTMENTS,
      );
    }

    // Also fetch departments from org structure (Structure Management)
    // CRITICAL: Filter out deleted/inactive departments
    try {
      const { getOrgNodes } = await import('@/lib/core/org/structure');
      const orgNodes = await getOrgNodes(request);
      if (orgNodes && !(orgNodes instanceof NextResponse)) {
        // Filter for department type nodes - CRITICAL: Exclude deleted/inactive
        const orgDepartments = orgNodes
          .filter((node: any) => {
            const isDepartment = node.type === 'department';
            const isActive = node.isActive !== false;
            const notDeleted = !node.deletedAt && node.deletedAt === undefined;
            return isDepartment && isActive && notDeleted;
          })
          .map((node: any) => ({
            id: node.id,
            floorId: node.parentId || '',
            floorKey: node.parentId || '',
            departmentId: node.id,
            departmentKey: node.code || node.name.toUpperCase().replace(/\s+/g, '_'),
            departmentName: node.name,
            key: node.code || node.name.toUpperCase().replace(/\s+/g, '_'),
            label_en: node.name,
            label_ar: node.name, // Use name as fallback if no Arabic label
            active: node.isActive !== false,
            createdAt: node.createdAt || new Date(),
            updatedAt: node.updatedAt || new Date(),
            createdBy: node.createdBy,
            updatedBy: node.updatedBy,
            tenantId: node.tenantId || tenantId,
          }));

        // Merge with existing departments (avoid duplicates by id)
        const existingIds = new Set(departments.map((d: any) => d.id));
        const newDepartments = orgDepartments.filter((d: any) => !existingIds.has(d.id));
        departments = [...departments, ...newDepartments];
      }
    } catch (error) {
      logger.warn('Failed to fetch org departments', { category: 'api', route: 'GET /api/structure/departments', error });
      // Continue with floor_departments only if org fetch fails
    }

    return NextResponse.json({ success: true, data: departments });
});

// POST - Create department
export const POST = withErrorHandler(async (request: NextRequest) => {
    // Use requireRoleAsync to check role first (admin role has full access)
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Check permission: admin.structure-management.create
    // But allow admin role to bypass permission check
    const user = await prisma.user.findFirst({ where: { id: authResult.userId } });
    const userPermissions = user?.permissions || [];
    const userRole = authResult.userRole;

    // Allow if user has admin role OR has the required permissions
    const hasPermission =
      userRole === 'admin' || // Admin role has full access
      userPermissions.includes('admin.structure-management.create') ||
      userPermissions.includes('admin.users') ||
      userPermissions.some((p: string) => p.startsWith('admin.')); // Allow any admin.* permission

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions. Admin role or admin.structure-management.create permission required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const v = validateBody(body, createDepartmentSchema);
    if ('error' in v) return v.error;
    const validatedData = v.data;

    // GOLDEN RULE: tenantId must ALWAYS come from session
    const { requireTenantId } = await import('@/lib/tenant');
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;
    // CRITICAL: Floor is optional - use empty string if not provided
    const department = await structureService.createDepartment({
      floorId: validatedData.floorId || '',
      floorKey: validatedData.floorKey || '',
      departmentKey: validatedData.departmentKey,
      departmentName: validatedData.departmentName,
      label_en: validatedData.label_en,
      label_ar: validatedData.label_ar,
      createdBy: authResult.userId,
      tenantId: tenantId, // Always set tenantId on creation
    });

    // CRITICAL: Also create org node so it appears in Organizational Structure
    // This ensures departments created from Intelligent Upload appear in Organizational Structure page
    logger.info('Starting org node creation', { category: 'api', route: 'POST /api/structure/departments', department: validatedData.label_en, departmentKey: validatedData.departmentKey, floorId: validatedData.floorId, floorKey: validatedData.floorKey, tenantId });

    try {
      logger.debug('Attempting to create org node for department', { category: 'api', route: 'POST /api/structure/departments', department: validatedData.label_en });
      const { createOrgNode, getOrgNodes } = await import('@/lib/core/org/structure');

      // Try to find floor as org node first
      let parentOrgNodeId: string | undefined = undefined;
      if (validatedData.floorId) {
        logger.debug('Looking for floor org node', { category: 'api', route: 'POST /api/structure/departments', floorId: validatedData.floorId, floorKey: validatedData.floorKey });
        const orgNodesResult = await getOrgNodes(request);
        if (orgNodesResult instanceof NextResponse) {
          logger.warn('Failed to get org nodes', { category: 'api', route: 'POST /api/structure/departments', status: orgNodesResult.status });
        } else {
          logger.debug('Found org nodes', { category: 'api', route: 'POST /api/structure/departments', count: orgNodesResult.length });
          const floorNode = orgNodesResult.find((node: any) =>
            node.id === validatedData.floorId || node.code === validatedData.floorKey
          );
          if (floorNode) {
            parentOrgNodeId = floorNode.id;
            logger.debug('Found floor org node', { category: 'api', route: 'POST /api/structure/departments', floorName: floorNode.name, parentOrgNodeId });
          } else {
            logger.debug('Floor org node not found, creating department at root level', { category: 'api', route: 'POST /api/structure/departments' });
          }
        }
      } else {
        logger.debug('No floorId provided, creating department at root level', { category: 'api', route: 'POST /api/structure/departments' });
      }

      // Always try to create org node, even without parent
      // If parentId is provided but not found, create at root level
      let orgNodeResult: OrgNode | NextResponse;

      if (parentOrgNodeId) {
        // Try with parent first
        orgNodeResult = await createOrgNode(request, {
          type: 'department',
          name: validatedData.label_en,
          code: validatedData.departmentKey,
          description: validatedData.label_ar || validatedData.label_en,
          parentId: parentOrgNodeId,
        });

        // If parent not found, retry at root level
        if (orgNodeResult instanceof NextResponse && orgNodeResult.status === 404) {
          const errorText = await orgNodeResult.text().catch(() => 'Unknown error');
          logger.warn('Parent not found (404), retrying at root level', { category: 'api', route: 'POST /api/structure/departments', error: errorText });

          orgNodeResult = await createOrgNode(request, {
            type: 'department',
            name: validatedData.label_en,
            code: validatedData.departmentKey,
            description: validatedData.label_ar || validatedData.label_en,
            parentId: undefined, // Create at root level
          });
        }
      } else {
        // Create at root level directly
        orgNodeResult = await createOrgNode(request, {
          type: 'department',
          name: validatedData.label_en,
          code: validatedData.departmentKey,
          description: validatedData.label_ar || validatedData.label_en,
          parentId: undefined, // Create at root level
        });
      }

      // Check result
      if (orgNodeResult instanceof NextResponse) {
        const errorText = await orgNodeResult.text().catch(() => 'Unknown error');
        logger.error('Failed to create org node', { category: 'api', route: 'POST /api/structure/departments', status: orgNodeResult.status, error: errorText, note: 'Department created in floor_departments but will NOT appear in Organizational Structure' });
      } else {
        logger.info('Successfully created org node for department', { category: 'api', route: 'POST /api/structure/departments', department: validatedData.label_en, orgNodeId: orgNodeResult.id, parentId: orgNodeResult.parentId || 'none', tenantId: orgNodeResult.tenantId });

        // VERIFY: Immediately query to confirm it can be retrieved
        try {
          const verifyResult = await getOrgNodes(request);
          if (verifyResult instanceof NextResponse) {
            logger.warn('Verification failed: Could not retrieve org nodes', { category: 'api', route: 'POST /api/structure/departments', status: verifyResult.status });
          } else {
            const foundNode = verifyResult.find((n: any) => n.id === orgNodeResult.id);
            if (foundNode) {
              logger.debug('Verified: Org node can be retrieved', { category: 'api', route: 'POST /api/structure/departments', orgNodeId: foundNode.id, name: foundNode.name });
            } else {
              logger.error('Verification failed: Org node NOT found in getOrgNodes', { category: 'api', route: 'POST /api/structure/departments', orgNodeId: orgNodeResult.id, totalNodes: verifyResult.length, retrievedNodes: verifyResult.map((n: any) => ({ id: n.id, name: n.name, tenantId: n.tenantId })) });
            }
          }
        } catch (verifyError) {
          logger.error('Verification error', { category: 'api', route: 'POST /api/structure/departments', error: verifyError });
        }

      }
    } catch (orgError: any) {
      logger.error('Exception while creating org node', { category: 'api', route: 'POST /api/structure/departments', error: orgError, stack: orgError?.stack });
      // Don't fail the request if org node creation fails - department is still created in floor_departments
    }

    // Invalidate department caches so subsequent GETs see the new department
    await invalidateOnDepartmentChange(tenantId);

    return NextResponse.json({ success: true, data: department }, { status: 201 });
});
