import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Employee Salary Suggestion API
 * GET /api/cvision/employees/[id]/salary-suggestion
 * Returns salary suggestions based on grade, department average, or similar role average.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  findById,
  createTenantFilter,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionEmployee, CVisionGrade } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  async (request, { tenantId }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
      }

      const empCollection = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
      const employee = await findById(empCollection, tenantId, id, true);

      if (!employee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }

      const suggestions: Array<{
        amount: number;
        source: 'grade_midpoint' | 'department_avg' | 'role_avg';
        label: string;
      }> = [];

      // Source A: Grade salary range midpoint
      if (employee.gradeId) {
        try {
          const gradeCollection = await getCVisionCollection<CVisionGrade>(tenantId, 'grades');
          const grade = await gradeCollection.findOne(
            createTenantFilter(tenantId, { id: employee.gradeId })
          );
          if (grade?.minSalary && grade?.maxSalary) {
            const midpoint = Math.round((grade.minSalary + grade.maxSalary) / 2);
            suggestions.push({
              amount: midpoint,
              source: 'grade_midpoint',
              label: `${grade.name} midpoint (${grade.minSalary.toLocaleString()}\u2013${grade.maxSalary.toLocaleString()})`,
            });
          }
        } catch (err) {
          logger.error('[SalarySuggestion] Failed to query grade:', err);
        }
      }

      // Source B: Department average basicSalary
      if (employee.departmentId) {
        try {
          const profileSectionCollection = await getCVisionCollection<any>(tenantId, 'employeeProfileSections');

          // Get active employees in same department (excluding current employee)
          const deptEmployees = await empCollection.find(
            createTenantFilter(tenantId, {
              departmentId: employee.departmentId,
              id: { $ne: employee.id },
              status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] },
            })
          ).project({ id: 1 }).toArray();

          const deptEmpIds = deptEmployees.map((e: any) => e.id);

          if (deptEmpIds.length > 0) {
            const financialSections = await profileSectionCollection.find(
              createTenantFilter(tenantId, {
                employeeId: { $in: deptEmpIds },
                sectionKey: 'FINANCIAL',
                'dataJson.basicSalary': { $gt: 0 },
              })
            ).project({ 'dataJson.basicSalary': 1 }).toArray();

            const salaries = financialSections
              .map((s: any) => s.dataJson?.basicSalary)
              .filter((v: any) => typeof v === 'number' && v > 0);

            if (salaries.length > 0) {
              const avg = Math.round(salaries.reduce((a: number, b: number) => a + b, 0) / salaries.length);
              suggestions.push({
                amount: avg,
                source: 'department_avg',
                label: `Department average (${salaries.length} employee${salaries.length !== 1 ? 's' : ''})`,
              });
            }
          }
        } catch (err) {
          logger.error('[SalarySuggestion] Failed to query department avg:', err);
        }
      }

      // Source C: Similar role average (same jobTitleId across all departments)
      if (employee.jobTitleId) {
        try {
          const profileSectionCollection = await getCVisionCollection<any>(tenantId, 'employeeProfileSections');

          const roleEmployees = await empCollection.find(
            createTenantFilter(tenantId, {
              jobTitleId: employee.jobTitleId,
              id: { $ne: employee.id },
              status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] },
            })
          ).project({ id: 1 }).toArray();

          const roleEmpIds = roleEmployees.map((e: any) => e.id);

          if (roleEmpIds.length > 0) {
            const financialSections = await profileSectionCollection.find(
              createTenantFilter(tenantId, {
                employeeId: { $in: roleEmpIds },
                sectionKey: 'FINANCIAL',
                'dataJson.basicSalary': { $gt: 0 },
              })
            ).project({ 'dataJson.basicSalary': 1 }).toArray();

            const salaries = financialSections
              .map((s: any) => s.dataJson?.basicSalary)
              .filter((v: any) => typeof v === 'number' && v > 0);

            if (salaries.length > 0) {
              const avg = Math.round(salaries.reduce((a: number, b: number) => a + b, 0) / salaries.length);
              suggestions.push({
                amount: avg,
                source: 'role_avg',
                label: `Similar role average (${salaries.length} employee${salaries.length !== 1 ? 's' : ''})`,
              });
            }
          }
        } catch (err) {
          logger.error('[SalarySuggestion] Failed to query role avg:', err);
        }
      }

      // Best suggestion = first by priority (grade > dept > role)
      const primary = suggestions.length > 0 ? suggestions[0] : null;

      return NextResponse.json({
        success: true,
        suggestion: primary,
        allSuggestions: suggestions,
      });
    } catch (error: any) {
      logger.error('[SalarySuggestion] Error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to get salary suggestion' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);
