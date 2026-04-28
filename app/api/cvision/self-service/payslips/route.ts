import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Self-Service Payslips API
 * GET /api/cvision/self-service/payslips - View own payslips
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';

export const dynamic = 'force-dynamic';

async function resolveEmployeeId(db: any, tenantId: string, userId: string): Promise<string | null> {
  let emp = await db.collection('cvision_employees').findOne({ tenantId, id: userId, deletedAt: null });
  if (emp) return (emp as any).id;
  emp = await db.collection('cvision_employees').findOne({ tenantId, userId, deletedAt: null });
  if (emp) return (emp as any).id;
  try {
    const userDoc = await db.collection('cvision_tenant_users').findOne({ tenantId, userId });
    if (userDoc?.email) {
      emp = await db.collection('cvision_employees').findOne({ tenantId, email: userDoc.email, deletedAt: null });
      if (emp) return (emp as any).id;
    }
  } catch { /* non-critical */ }
  return userId; // fallback
}

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId, userId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const year = searchParams.get('year');
      const month = searchParams.get('month');

      const db = await getCVisionDb(tenantId);
      const empId = await resolveEmployeeId(db, tenantId, userId);

      const filter: any = { tenantId, employeeId: empId };
      if (year) filter.year = parseInt(year);
      if (month) filter.month = parseInt(month);

      const payslips = await db.collection('cvision_payslips')
        .find(filter)
        .sort({ year: -1, month: -1 })
        .limit(24) // Last 2 years
        .toArray();

      // Sanitize: only return own payslip data
      const sanitized = payslips.map((p: any) => ({
        id: p.id || p._id?.toString(),
        employeeId: p.employeeId,
        month: p.month,
        year: p.year,
        period: p.period || `${p.year}-${String(p.month).padStart(2, '0')}`,
        basicSalary: p.basicSalary,
        housingAllowance: p.housingAllowance,
        transportAllowance: p.transportAllowance,
        otherAllowances: p.otherAllowances || 0,
        overtimePay: p.overtimePay || 0,
        grossPay: p.grossPay || p.totalEarnings,
        gosiDeduction: p.gosiDeduction || p.gosiEmployee,
        otherDeductions: p.otherDeductions || 0,
        loanDeduction: p.loanDeduction || 0,
        totalDeductions: p.totalDeductions,
        netPay: p.netPay || p.netSalary,
        status: p.status,
        createdAt: p.createdAt,
        paidAt: p.paidAt,
      }));

      return NextResponse.json({ success: true, data: sanitized });
    } catch (error: any) {
      logger.error('[CVision Self-Service Payslips GET]', error?.message || String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.SELF_SERVICE }
);
