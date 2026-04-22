import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Leave Accrual API
 * POST /api/cvision/leave/accrual - Accrue leave balances based on service period
 *
 * Saudi Labor Law:
 *   - < 5 years service: 21 days annual leave
 *   - >= 5 years service: 30 days annual leave
 *   - Monthly accrual: entitlement / 12
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { calculateAnnualEntitlement } from '@/lib/cvision/leaves';
import { logCVisionAudit, createCVisionAuditContext } from '@/lib/cvision/audit';

export const dynamic = 'force-dynamic';

export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const { action = 'accrue-monthly', employeeId, year, month } = body;

      const db = await getCVisionDb(tenantId);
      const auditCtx = createCVisionAuditContext({ userId, role, tenantId, user }, request);
      const targetYear = year || new Date().getFullYear();
      const targetMonth = month || new Date().getMonth() + 1;

      if (action === 'accrue-monthly') {
        // Get active employees (or single employee)
        const empFilter: any = { tenantId, deletedAt: null, status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] } };
        if (employeeId) empFilter.id = employeeId;

        const employees = await db.collection('cvision_employees')
          .find(empFilter)
          .limit(2000)
          .toArray();

        const results: any[] = [];

        for (const emp of employees) {
          const e = emp as any;
          const hireDate = new Date(e.hiredAt || e.createdAt);
          const yearsOfService = (Date.now() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
          const annualEntitlement = calculateAnnualEntitlement(yearsOfService);
          const monthlyAccrual = Math.round((annualEntitlement / 12) * 100) / 100;

          // Check if balance record exists for this year
          const existing = await db.collection('cvision_leave_balances').findOne({
            tenantId, employeeId: e.id, year: targetYear, leaveType: 'ANNUAL',
          });

          if (existing) {
            // Update entitled amount (accrue monthly)
            const newEntitled = Math.min(annualEntitlement, ((existing as any).entitled || 0) + monthlyAccrual);
            await db.collection('cvision_leave_balances').updateOne(
              { tenantId, employeeId: e.id, year: targetYear, leaveType: 'ANNUAL' },
              { $set: { entitled: newEntitled, updatedAt: new Date(), lastAccrualMonth: targetMonth } }
            );
            results.push({ employeeId: e.id, accrued: monthlyAccrual, newEntitled, action: 'updated' });
          } else {
            // Create new balance record
            await db.collection('cvision_leave_balances').insertOne({
              id: uuidv4(),
              tenantId,
              employeeId: e.id,
              year: targetYear,
              leaveType: 'ANNUAL',
              entitled: monthlyAccrual,
              used: 0,
              pending: 0,
              carried: 0,
              lastAccrualMonth: targetMonth,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            results.push({ employeeId: e.id, accrued: monthlyAccrual, newEntitled: monthlyAccrual, action: 'created' });
          }
        }

        await logCVisionAudit(auditCtx, 'leave_accrual', 'leave', {
          resourceId: 'batch',
          metadata: { year: targetYear, month: targetMonth, employeesProcessed: results.length },
        });

        return NextResponse.json({
          success: true,
          data: {
            year: targetYear,
            month: targetMonth,
            employeesProcessed: results.length,
            results,
          },
        });
      }

      if (action === 'initialize-year') {
        // Initialize annual leave balances for all active employees at the start of a year
        const empFilter: any = { tenantId, deletedAt: null, status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] } };
        const employees = await db.collection('cvision_employees').find(empFilter).limit(2000).toArray();

        let created = 0;
        let skipped = 0;

        for (const emp of employees) {
          const e = emp as any;
          const hireDate = new Date(e.hiredAt || e.createdAt);
          const yearsOfService = (Date.now() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
          const annualEntitlement = calculateAnnualEntitlement(yearsOfService);

          const existing = await db.collection('cvision_leave_balances').findOne({
            tenantId, employeeId: e.id, year: targetYear, leaveType: 'ANNUAL',
          });

          if (existing) {
            skipped++;
            continue;
          }

          // Check for carry-over from previous year
          const prevYearBal = await db.collection('cvision_leave_balances').findOne({
            tenantId, employeeId: e.id, year: targetYear - 1, leaveType: 'ANNUAL',
          });
          const carryOver = prevYearBal ? Math.max(0, ((prevYearBal as any).entitled || 0) - ((prevYearBal as any).used || 0)) : 0;
          // Saudi law: max carry-over is typically half of entitlement
          const maxCarryOver = Math.floor(annualEntitlement / 2);
          const actualCarryOver = Math.min(carryOver, maxCarryOver);

          await db.collection('cvision_leave_balances').insertOne({
            id: uuidv4(),
            tenantId,
            employeeId: e.id,
            year: targetYear,
            leaveType: 'ANNUAL',
            entitled: annualEntitlement,
            used: 0,
            pending: 0,
            carried: actualCarryOver,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          created++;
        }

        await logCVisionAudit(auditCtx, 'leave_year_init', 'leave', {
          resourceId: 'batch',
          metadata: { year: targetYear, created, skipped },
        });

        return NextResponse.json({
          success: true,
          data: { year: targetYear, created, skipped, total: employees.length },
        });
      }

      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    } catch (error: any) {
      logger.error('[CVision Leave Accrual POST]', error?.message || String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.LEAVES_WRITE }
);
