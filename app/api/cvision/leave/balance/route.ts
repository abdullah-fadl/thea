import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Leave Balance API
 * GET /api/cvision/leave/balance - Get employee leave balances
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { calculateAnnualEntitlement, SAUDI_LEAVE_ENTITLEMENTS } from '@/lib/cvision/leaves';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const employeeId = searchParams.get('employeeId');
      const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
      const departmentId = searchParams.get('departmentId');

      const db = await getCVisionDb(tenantId);

      // Single employee balance
      if (employeeId) {
        const employee = await db.collection('cvision_employees').findOne({ tenantId, id: employeeId, deletedAt: null });
        if (!employee) {
          return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
        }

        const balances = await db.collection('cvision_leave_balances')
          .find({ tenantId, employeeId, year })
          .toArray();

        const hireDate = new Date((employee as any).hiredAt || (employee as any).createdAt);
        const yearsOfService = (Date.now() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
        const annualEntitlement = calculateAnnualEntitlement(yearsOfService);

        const balanceMap: Record<string, any> = {};
        for (const b of balances) {
          const bal = b as any;
          balanceMap[bal.leaveType] = {
            leaveType: bal.leaveType,
            entitled: bal.entitled || 0,
            used: bal.used || 0,
            pending: bal.pending || 0,
            carried: bal.carried || 0,
            available: (bal.entitled || 0) - (bal.used || 0) - (bal.pending || 0),
          };
        }

        // Ensure annual leave is present
        if (!balanceMap['ANNUAL']) {
          balanceMap['ANNUAL'] = {
            leaveType: 'ANNUAL',
            entitled: annualEntitlement,
            used: 0,
            pending: 0,
            carried: 0,
            available: annualEntitlement,
          };
        }

        return NextResponse.json({
          success: true,
          data: {
            employeeId,
            employeeName: `${(employee as any).firstName || ''} ${(employee as any).lastName || ''}`.trim(),
            year,
            yearsOfService: Math.round(yearsOfService * 10) / 10,
            annualEntitlement,
            balances: Object.values(balanceMap),
            entitlementRules: SAUDI_LEAVE_ENTITLEMENTS,
          },
        });
      }

      // Department or all employees summary
      const empFilter: any = { tenantId, deletedAt: null, status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] } };
      if (departmentId) empFilter.departmentId = departmentId;

      const employees = await db.collection('cvision_employees')
        .find(empFilter)
        .limit(500)
        .toArray();

      const empIds = employees.map((e: any) => e.id);
      const allBalances = await db.collection('cvision_leave_balances')
        .find({ tenantId, year, employeeId: { $in: empIds } })
        .toArray();

      const balanceByEmp = new Map<string, any[]>();
      for (const b of allBalances) {
        const bal = b as any;
        if (!balanceByEmp.has(bal.employeeId)) balanceByEmp.set(bal.employeeId, []);
        balanceByEmp.get(bal.employeeId)!.push(bal);
      }

      const summary = employees.map((emp: any) => {
        const empBalances = balanceByEmp.get(emp.id) || [];
        const annualBal = empBalances.find((b: any) => b.leaveType === 'ANNUAL');
        return {
          employeeId: emp.id,
          employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
          departmentId: emp.departmentId,
          annualEntitled: annualBal?.entitled || 0,
          annualUsed: annualBal?.used || 0,
          annualPending: annualBal?.pending || 0,
          annualAvailable: (annualBal?.entitled || 0) - (annualBal?.used || 0) - (annualBal?.pending || 0),
          totalLeaveTypes: empBalances.length,
        };
      });

      return NextResponse.json({ success: true, data: summary, total: summary.length });
    } catch (error: any) {
      logger.error('[CVision Leave Balance GET]', error?.message || String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.LEAVES_READ }
);
