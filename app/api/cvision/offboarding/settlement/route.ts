import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Offboarding Final Settlement API
 * GET  /api/cvision/offboarding/settlement - Get settlement calculation
 * POST /api/cvision/offboarding/settlement - Calculate and save final settlement
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { logCVisionAudit, createCVisionAuditContext } from '@/lib/cvision/audit';
import { calculateFinalSettlement, getOffboarding } from '@/lib/cvision/employees/offboarding-engine';

export const dynamic = 'force-dynamic';

// GET - Get existing settlement
export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const employeeId = searchParams.get('employeeId');

      if (!employeeId) {
        return NextResponse.json({ success: false, error: 'employeeId is required' }, { status: 400 });
      }

      const db = await getCVisionDb(tenantId);
      const process = await getOffboarding(db, tenantId, employeeId);

      if (!process) {
        return NextResponse.json({ success: false, error: 'No active offboarding found' }, { status: 404 });
      }

      const settlement = (process as any).finalSettlement;
      if (!settlement) {
        return NextResponse.json({
          success: true,
          data: { status: 'NOT_CALCULATED', employeeId },
          message: 'Settlement not yet calculated',
        });
      }

      // Enrich with employee info
      const employee = await db.collection('cvision_employees').findOne({ tenantId, id: employeeId });

      return NextResponse.json({
        success: true,
        data: {
          employeeId,
          employeeName: employee ? `${(employee as any).firstName || ''} ${(employee as any).lastName || ''}`.trim() : null,
          employeeNumber: (employee as any)?.employeeNumber,
          offboardingType: (process as any).type,
          lastWorkingDay: (process as any).lastWorkingDay,
          settlement,
        },
      });
    } catch (error: any) {
      logger.error('[CVision Settlement GET]', error?.message || String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_READ }
);

// POST - Calculate final settlement
export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const { employeeId } = body;

      if (!employeeId) {
        return NextResponse.json({ success: false, error: 'employeeId is required' }, { status: 400 });
      }

      const db = await getCVisionDb(tenantId);
      const settlement = await calculateFinalSettlement(db, tenantId, employeeId);

      const auditCtx = createCVisionAuditContext({ userId, role, tenantId, user }, request);
      await logCVisionAudit(auditCtx, 'offboarding_settlement_calculate', 'employee', {
        resourceId: employeeId,
        metadata: { totalSettlement: settlement.totalSettlement },
      });

      return NextResponse.json({
        success: true,
        data: settlement,
        message: 'Final settlement calculated',
      });
    } catch (error: any) {
      logger.error('[CVision Settlement POST]', error?.message || String(error));
      return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_WRITE }
);
