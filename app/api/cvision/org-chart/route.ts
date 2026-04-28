import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Organizational Chart API
 * GET /api/cvision/org-chart - Get org hierarchy as tree structure
 *
 * Returns tree based on department/manager relationships.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';

export const dynamic = 'force-dynamic';

interface OrgNode {
  id: string;
  name: string;
  nameAr?: string;
  type: 'organization' | 'department' | 'unit' | 'employee';
  title?: string;
  titleAr?: string;
  email?: string;
  employeeNumber?: string;
  status?: string;
  headCount?: number;
  children: OrgNode[];
}

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const view = searchParams.get('view') || 'department'; // 'department' | 'manager' | 'flat'
      const departmentId = searchParams.get('departmentId');

      const db = await getCVisionDb(tenantId);

      // Fetch departments, units, and employees
      const [departments, units, employees] = await Promise.all([
        db.collection('cvision_departments')
          .find({ tenantId, isActive: { $ne: false }, deletedAt: null })
          .toArray(),
        db.collection('cvision_units')
          .find({ tenantId, isActive: { $ne: false } })
          .toArray(),
        db.collection('cvision_employees')
          .find({ tenantId, deletedAt: null, status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] } })
          .project({ id: 1, firstName: 1, lastName: 1, firstNameAr: 1, lastNameAr: 1, email: 1, employeeNumber: 1, departmentId: 1, unitId: 1, managerId: 1, jobTitle: 1, jobTitleAr: 1, status: 1 })
          .limit(2000)
          .toArray(),
      ]);

      if (view === 'flat') {
        // Return flat list with department/unit info
        const deptMap = new Map(departments.map((d: any) => [d.id, d]));
        const unitMap = new Map(units.map((u: any) => [u.id, u]));

        const flat = employees.map((e: any) => ({
          id: e.id,
          name: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
          nameAr: `${e.firstNameAr || ''} ${e.lastNameAr || ''}`.trim() || undefined,
          email: e.email,
          employeeNumber: e.employeeNumber,
          jobTitle: e.jobTitle,
          departmentId: e.departmentId,
          departmentName: deptMap.get(e.departmentId)?.name || '',
          unitId: e.unitId,
          unitName: unitMap.get(e.unitId)?.name || '',
          managerId: e.managerId,
        }));

        return NextResponse.json({ success: true, data: flat });
      }

      if (view === 'manager') {
        // Manager-based hierarchy
        const empMap = new Map(employees.map((e: any) => [e.id, e]));
        const childrenMap = new Map<string, any[]>();

        for (const emp of employees) {
          const e = emp as any;
          const mgrId = e.managerId || 'root';
          if (!childrenMap.has(mgrId)) childrenMap.set(mgrId, []);
          childrenMap.get(mgrId)!.push(e);
        }

        function buildManagerTree(managerId: string): OrgNode[] {
          const directReports = childrenMap.get(managerId) || [];
          return directReports.map((e: any) => ({
            id: e.id,
            name: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
            nameAr: `${e.firstNameAr || ''} ${e.lastNameAr || ''}`.trim() || undefined,
            type: 'employee' as const,
            title: e.jobTitle,
            titleAr: e.jobTitleAr,
            email: e.email,
            employeeNumber: e.employeeNumber,
            status: e.status,
            children: buildManagerTree(e.id),
          }));
        }

        const roots = buildManagerTree('root');
        // Also find employees whose managerId doesn't exist (orphans go to root)
        const allManaged = new Set<string>();
        for (const [, children] of childrenMap) {
          for (const c of children) allManaged.add(c.id);
        }

        return NextResponse.json({ success: true, data: roots });
      }

      // Default: department-based hierarchy
      const empByDept = new Map<string, any[]>();
      for (const emp of employees) {
        const e = emp as any;
        const deptId = e.departmentId || 'unassigned';
        if (departmentId && deptId !== departmentId) continue;
        if (!empByDept.has(deptId)) empByDept.set(deptId, []);
        empByDept.get(deptId)!.push(e);
      }

      const unitsByDept = new Map<string, any[]>();
      for (const unit of units) {
        const u = unit as any;
        if (!unitsByDept.has(u.departmentId)) unitsByDept.set(u.departmentId, []);
        unitsByDept.get(u.departmentId)!.push(u);
      }

      // Build parent-child department tree
      const deptMap = new Map(departments.map((d: any) => [d.id, d]));
      const deptChildrenMap = new Map<string, any[]>();
      for (const dept of departments) {
        const d = dept as any;
        const parentId = d.parentId || 'root';
        if (!deptChildrenMap.has(parentId)) deptChildrenMap.set(parentId, []);
        deptChildrenMap.get(parentId)!.push(d);
      }

      function buildDeptTree(parentId: string): OrgNode[] {
        const childDepts = deptChildrenMap.get(parentId) || [];
        return childDepts.map((dept: any) => {
          const deptEmps = empByDept.get(dept.id) || [];
          const deptUnits = unitsByDept.get(dept.id) || [];

          const unitNodes: OrgNode[] = deptUnits.map((u: any) => ({
            id: u.id,
            name: u.name || '',
            nameAr: u.nameAr || undefined,
            type: 'unit' as const,
            headCount: deptEmps.filter((e: any) => e.unitId === u.id).length,
            children: deptEmps
              .filter((e: any) => e.unitId === u.id)
              .map((e: any) => ({
                id: e.id,
                name: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
                nameAr: `${e.firstNameAr || ''} ${e.lastNameAr || ''}`.trim() || undefined,
                type: 'employee' as const,
                title: e.jobTitle,
                titleAr: e.jobTitleAr,
                email: e.email,
                employeeNumber: e.employeeNumber,
                status: e.status,
                children: [],
              })),
          }));

          // Employees without unit
          const noUnitEmps = deptEmps.filter((e: any) => !e.unitId);
          const noUnitNodes: OrgNode[] = noUnitEmps.map((e: any) => ({
            id: e.id,
            name: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
            nameAr: `${e.firstNameAr || ''} ${e.lastNameAr || ''}`.trim() || undefined,
            type: 'employee' as const,
            title: e.jobTitle,
            titleAr: e.jobTitleAr,
            email: e.email,
            employeeNumber: e.employeeNumber,
            status: e.status,
            children: [],
          }));

          return {
            id: dept.id,
            name: dept.name || '',
            nameAr: dept.nameAr || undefined,
            type: 'department' as const,
            headCount: deptEmps.length,
            children: [...buildDeptTree(dept.id), ...unitNodes, ...noUnitNodes],
          };
        });
      }

      const tree: OrgNode = {
        id: 'org-root',
        name: 'Organization',
        nameAr: 'المنظمة',
        type: 'organization',
        headCount: employees.length,
        children: buildDeptTree('root'),
      };

      // Add unassigned employees to root if they exist
      const unassigned = empByDept.get('unassigned') || [];
      if (unassigned.length > 0) {
        tree.children.push({
          id: 'unassigned',
          name: 'Unassigned',
          nameAr: 'غير مُعيّن',
          type: 'department',
          headCount: unassigned.length,
          children: unassigned.map((e: any) => ({
            id: e.id,
            name: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
            nameAr: `${e.firstNameAr || ''} ${e.lastNameAr || ''}`.trim() || undefined,
            type: 'employee' as const,
            title: e.jobTitle,
            email: e.email,
            children: [],
          })),
        });
      }

      return NextResponse.json({ success: true, data: tree });
    } catch (error: any) {
      logger.error('[CVision OrgChart GET]', error?.message || String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_READ }
);
