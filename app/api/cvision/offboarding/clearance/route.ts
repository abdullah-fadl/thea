import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Offboarding Clearance API
 * GET  /api/cvision/offboarding/clearance - Get clearance checklist
 * POST /api/cvision/offboarding/clearance - Complete a checklist item
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { logCVisionAudit, createCVisionAuditContext } from '@/lib/cvision/audit';
import { completeOffboardingItem, getOffboarding } from '@/lib/cvision/employees/offboarding-engine';

export const dynamic = 'force-dynamic';

// GET - Get clearance checklist for an employee
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

      const checklist = (process as any).checklist || [];
      const completed = checklist.filter((c: any) => c.status === 'COMPLETED').length;

      return NextResponse.json({
        success: true,
        data: {
          employeeId,
          status: (process as any).status,
          checklist,
          progress: {
            completed,
            total: checklist.length,
            percent: checklist.length > 0 ? Math.round((completed / checklist.length) * 100) : 0,
          },
        },
      });
    } catch (error: any) {
      logger.error('[CVision Offboarding Clearance GET]', error?.message || String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);

// POST - Complete a clearance item
export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const { employeeId, itemId, notes } = body;

      if (!employeeId || !itemId) {
        return NextResponse.json(
          { success: false, error: 'employeeId and itemId are required' },
          { status: 400 }
        );
      }

      const db = await getCVisionDb(tenantId);
      const result = await completeOffboardingItem(db, tenantId, employeeId, itemId, userId, notes);

      const auditCtx = createCVisionAuditContext({ userId, role, tenantId, user }, request);
      await logCVisionAudit(auditCtx, 'offboarding_clearance_complete', 'employee', {
        resourceId: employeeId,
        metadata: { itemId, completedCount: result.completedCount, totalCount: result.totalCount },
      });

      return NextResponse.json({
        success: true,
        data: result,
        message: `Clearance item completed (${result.completedCount}/${result.totalCount})`,
      });
    } catch (error: any) {
      logger.error('[CVision Offboarding Clearance POST]', error?.message || String(error));
      return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);
