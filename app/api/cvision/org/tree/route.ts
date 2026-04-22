import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Organization Tree API
 * GET /api/cvision/org/tree - Get organization tree structure
 * 
 * Returns departments with parent-child relations and units in deterministic order.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionDepartment, CVisionUnit } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface OrgTreeNode {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  description?: string;
  parentId?: string | null;
  managerId?: string | null;
  isActive: boolean;
  sortOrder?: number;
  children: OrgTreeNode[];
  units: Array<{
    id: string;
    code: string;
    name: string;
    nameAr?: string;
    isActive: boolean;
    sortOrder?: number;
  }>;
}

/**
 * Build organization tree with deterministic ordering
 * Ordering: sortOrder ASC, then code ASC, then name ASC
 */
function buildOrgTree(
  departments: CVisionDepartment[],
  units: CVisionUnit[]
): OrgTreeNode[] {
  // Sort departments deterministically: sortOrder ASC, then code ASC
  const sortedDepts = [...departments].sort((a, b) => {
    // First by sortOrder (nulls last)
    if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
    } else if (a.sortOrder !== undefined) {
      return -1;
    } else if (b.sortOrder !== undefined) {
      return 1;
    }
    // Then by code
    return a.code.localeCompare(b.code);
  });

  // Create a map of department ID to units
  const unitsByDept = new Map<string, CVisionUnit[]>();
  for (const unit of units) {
    if (!unitsByDept.has(unit.departmentId)) {
      unitsByDept.set(unit.departmentId, []);
    }
    unitsByDept.get(unit.departmentId)!.push(unit);
  }

  // Sort units deterministically: sortOrder ASC, then code ASC
  for (const [deptId, deptUnits] of unitsByDept.entries()) {
    deptUnits.sort((a, b) => {
      if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
      } else if (a.sortOrder !== undefined) {
        return -1;
      } else if (b.sortOrder !== undefined) {
        return 1;
      }
      return a.code.localeCompare(b.code);
    });
  }

  // Build tree structure
  const deptMap = new Map<string, OrgTreeNode>();
  const rootNodes: OrgTreeNode[] = [];

  // First pass: create all nodes
  for (const dept of sortedDepts) {
    const node: OrgTreeNode = {
      id: dept.id,
      code: dept.code,
      name: dept.name,
      nameAr: dept.nameAr,
      description: dept.description,
      parentId: dept.parentId,
      managerId: dept.managerId,
      isActive: dept.isActive,
      sortOrder: dept.sortOrder,
      children: [],
      units: (unitsByDept.get(dept.id) || []).map((unit) => ({
        id: unit.id,
        code: unit.code,
        name: unit.name,
        nameAr: unit.nameAr,
        isActive: unit.isActive,
        sortOrder: unit.sortOrder,
      })),
    };
    deptMap.set(dept.id, node);
  }

  // Second pass: build parent-child relationships
  for (const node of deptMap.values()) {
    if (node.parentId) {
      const parent = deptMap.get(node.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found or filtered out, treat as root
        rootNodes.push(node);
      }
    } else {
      rootNodes.push(node);
    }
  }

  // Sort children recursively
  function sortChildren(node: OrgTreeNode) {
    node.children.sort((a, b) => {
      if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
      } else if (a.sortOrder !== undefined) {
        return -1;
      } else if (b.sortOrder !== undefined) {
        return 1;
      }
      return a.code.localeCompare(b.code);
    });
    node.children.forEach(sortChildren);
  }

  rootNodes.forEach(sortChildren);

  return rootNodes;
}

// GET - Get organization tree
export const GET = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const includeArchived = searchParams.get('includeArchived') === 'true';
      const includeInactive = searchParams.get('includeInactive') === 'true';

      const deptCollection = await getCVisionCollection<CVisionDepartment>(
        tenantId,
        'departments'
      );
      const unitCollection = await getCVisionCollection<CVisionUnit>(
        tenantId,
        'units'
      );

      // Build filters
      const deptFilter: Record<string, any> = createTenantFilter(tenantId);
      const unitFilter: Record<string, any> = createTenantFilter(tenantId);

      if (!includeArchived) {
        deptFilter.isArchived = false;
        unitFilter.isArchived = false;
      }

      if (!includeInactive) {
        deptFilter.isActive = true;
        unitFilter.isActive = true;
      }

      // Fetch all departments and units
      const [departments, units] = await Promise.all([
        deptCollection.find(deptFilter).limit(500).toArray(),
        unitCollection.find(unitFilter).limit(500).toArray(),
      ]);

      // Build tree structure
      const tree = buildOrgTree(departments, units);

      return NextResponse.json({
        success: true,
        tree,
        totalDepartments: departments.length,
        totalUnits: units.length,
      });
    } catch (error: any) {
      logger.error('[CVision Org Tree GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_READ }
);
