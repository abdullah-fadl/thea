import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Manpower Report Excel Export
 * GET /api/cvision/reports/manpower.xlsx - Export manpower report to Excel
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx } from '@/lib/cvision/authz/enforce';
import type { CVisionEmployee, CVisionDepartment, CVisionPositionType } from '@/lib/cvision/types';
import { getCVisionCollection, createTenantFilter } from '@/lib/cvision/db';
import { normalizeStatus } from '@/lib/cvision/status';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Export manpower report to Excel
export const GET = withAuthTenant(
  async (request, { tenantId, userId }, params) => {
    try {
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult;
      }

      const { searchParams } = new URL(request.url);
      const departmentId = searchParams.get('departmentId') || undefined;
      const asOfParam = searchParams.get('asOf');
      const asOf = asOfParam ? new Date(asOfParam) : new Date();
      const asOfStr = asOf.toISOString().split('T')[0];

      // Get manpower summary data
      const summaryRes = await fetch(
        `${request.nextUrl.origin}/api/cvision/manpower/summary?asOf=${asOfStr}${departmentId ? `&departmentId=${departmentId}` : ''}`,
        {
          headers: {
            cookie: request.headers.get('cookie') || '',
          },
        }
      );

      if (!summaryRes.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch manpower summary' },
          { status: 500 }
        );
      }

      const summaryData = await summaryRes.json();

      // Get employees data for Sheet2 - Include ALL employees (Active, Probation, Resigned, Terminated)
      const empCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );

      // Filter: Only exclude archived employees, but include all statuses
      let empFilter: any = createTenantFilter(tenantId, {
        isArchived: { $ne: true },
      });
      if (departmentId) {
        empFilter.departmentId = departmentId;
      }

      const employees = await empCollection.find(empFilter).limit(5000).toArray();

      // Get departments, positions, and managers for employee details
      const deptCollection = await getCVisionCollection<CVisionDepartment>(tenantId, 'departments');
      // Use budgetedPositions as primary, positionTypes as legacy fallback
      const positionCollection = await getCVisionCollection<CVisionPositionType>(tenantId, 'budgetedPositions');
      
      // Build manager lookup map (managerEmployeeId -> manager name)
      const managerIds = new Set<string>();
      employees.forEach(emp => {
        if (emp.managerEmployeeId) {
          managerIds.add(emp.managerEmployeeId);
        }
      });
      
      const managerMap = new Map<string, string>();
      if (managerIds.size > 0) {
        const managers = await empCollection.find(
          createTenantFilter(tenantId, { id: { $in: Array.from(managerIds) } })
        ).limit(5000).toArray();
        managers.forEach(mgr => {
          managerMap.set(mgr.id, `${mgr.firstName} ${mgr.lastName}`);
        });
      }

      // Create Excel workbook using exceljs
      const workbook = new ExcelJS.Workbook();
      
      // Sheet1: Manpower Summary
      const summarySheet = workbook.addWorksheet('Manpower Summary');
      summarySheet.columns = [
        { header: 'Department', key: 'department', width: 20 },
        { header: 'Position', key: 'position', width: 20 },
        { header: 'Budgeted Headcount', key: 'budgeted', width: 18 },
        { header: 'Active Headcount', key: 'active', width: 18 },
        { header: 'Exited (Last 30 Days)', key: 'exited', width: 22 },
        { header: 'Variance', key: 'variance', width: 12 },
        { header: 'Utilization %', key: 'utilization', width: 16 },
      ];

      // Add data rows
      for (const row of summaryData.rows || []) {
        summarySheet.addRow({
          department: row.departmentName,
          position: row.positionTitle,
          budgeted: row.budgetedHeadcount,
          active: row.activeHeadcount,
          exited: row.exited30d,
          variance: row.variance,
          utilization: `${row.utilizationPct.toFixed(1)}%`,
        });
      }

      // Add totals row
      summarySheet.addRow({
        department: 'TOTALS',
        position: '',
        budgeted: summaryData.totals?.budgetedHeadcount || 0,
        active: summaryData.totals?.activeHeadcount || 0,
        exited: summaryData.totals?.exited30d || 0,
        variance: summaryData.totals?.variance || 0,
        utilization: '',
      });

      // Format header row
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getRow(summarySheet.rowCount).font = { bold: true };

      // Sheet2: Employees - Full employee dataset
      const employeesSheet = workbook.addWorksheet('Employees');
      employeesSheet.columns = [
        { header: 'Employee ID', key: 'employeeId', width: 15 },
        { header: 'Full Name', key: 'fullName', width: 30 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Department', key: 'department', width: 25 },
        { header: 'Position', key: 'position', width: 25 },
        { header: 'Hire Date', key: 'hireDate', width: 15 },
        { header: 'Exit Date', key: 'exitDate', width: 15 },
        { header: 'Manager', key: 'manager', width: 30 },
      ];

      // Build department and position lookup maps (batch load for efficiency)
      const deptIds = new Set<string>();
      const positionIds = new Set<string>();
      
      employees.forEach(emp => {
        if (emp.departmentId) deptIds.add(emp.departmentId);
        if (emp.positionId) positionIds.add(emp.positionId);
      });
      
      const deptMap = new Map<string, string>();
      const positionMap = new Map<string, string>();
      
      // Load all departments at once
      if (deptIds.size > 0) {
        const depts = await deptCollection.find(
          createTenantFilter(tenantId, { id: { $in: Array.from(deptIds) } })
        ).limit(500).toArray();
        depts.forEach(dept => {
          deptMap.set(dept.id, dept.name || '');
        });
      }
      
      // Load all positions at once (budgetedPositions first, then legacy positionTypes fallback)
      if (positionIds.size > 0) {
        const positions = await positionCollection.find(
          createTenantFilter(tenantId, { id: { $in: Array.from(positionIds) } })
        ).limit(5000).toArray();
        positions.forEach(pos => {
          positionMap.set(pos.id, (pos as Record<string, unknown>).positionCode as string || pos.title || '');
        });

        // Fallback: any IDs not found in budgetedPositions, try positionTypes
        const missingIds = Array.from(positionIds).filter(id => !positionMap.has(id));
        if (missingIds.length > 0) {
          const legacyPosCollection = await getCVisionCollection<CVisionPositionType>(tenantId, 'positionTypes');
          const legacyPositions = await legacyPosCollection.find(
            createTenantFilter(tenantId, { id: { $in: missingIds } })
          ).limit(5000).toArray();
          legacyPositions.forEach(pos => {
            positionMap.set(pos.id, pos.title || '');
          });
        }
      }

      // Add employee rows - Use canonical root fields (not profile JSON)
      for (const emp of employees) {
        // Resolve department name from canonical departmentId
        const deptName = emp.departmentId ? (deptMap.get(emp.departmentId) || '-') : '-';
        
        // Resolve position name from canonical positionId, or show "Unassigned" if missing
        const positionName = emp.positionId 
          ? (positionMap.get(emp.positionId) || '-') 
          : 'Unassigned';
        
        // Resolve manager name from canonical managerEmployeeId
        const managerName = emp.managerEmployeeId 
          ? (managerMap.get(emp.managerEmployeeId) || '-') 
          : '-';
        
        // Normalize status (use canonical status field)
        const status = normalizeStatus(emp.status);
        
        // Format dates
        const hireDate = emp.hiredAt 
          ? new Date(emp.hiredAt).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
          : '-';
        
        // Determine exit date based on status and canonical fields
        let exitDate = '-';
        if (emp.status === 'RESIGNED' && emp.resignedAt) {
          exitDate = new Date(emp.resignedAt).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
        } else if (emp.status === 'TERMINATED' && emp.terminatedAt) {
          exitDate = new Date(emp.terminatedAt).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
        }

        employeesSheet.addRow({
          employeeId: emp.employeeNo || emp.id,
          fullName: `${emp.firstName} ${emp.lastName}`,
          email: emp.email || '-',
          status,
          department: deptName,
          position: positionName,
          hireDate,
          exitDate,
          manager: managerName,
        });
      }

      // Format header row
      employeesSheet.getRow(1).font = { bold: true };

      // Generate Excel buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `CVision_Manpower_${asOfStr}.xlsx`;

      // Convert buffer to Uint8Array if needed
      const uint8Array = buffer instanceof Uint8Array 
        ? buffer 
        : new Uint8Array(buffer);

      return new NextResponse(uint8Array, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': uint8Array.length.toString(),
        },
      });
    } catch (error: any) {
      logger.error('[CVision Manpower Report Excel GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);
