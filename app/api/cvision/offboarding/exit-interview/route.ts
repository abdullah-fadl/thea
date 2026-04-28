import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Offboarding Exit Interview API
 * GET  /api/cvision/offboarding/exit-interview - Get exit interview data
 * POST /api/cvision/offboarding/exit-interview - Save exit interview
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { logCVisionAudit, createCVisionAuditContext } from '@/lib/cvision/audit';
import { saveExitInterview, getOffboarding } from '@/lib/cvision/employees/offboarding-engine';

export const dynamic = 'force-dynamic';

// GET - Get exit interview for an employee
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

      const interview = (process as any).exitInterview;
      if (!interview) {
        return NextResponse.json({
          success: true,
          data: { status: 'NOT_CONDUCTED', employeeId },
        });
      }

      return NextResponse.json({ success: true, data: interview });
    } catch (error: any) {
      logger.error('[CVision Exit Interview GET]', error?.message || String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);

// POST - Save exit interview
export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const {
        employeeId,
        satisfactionRating,
        reasonForLeaving,
        feedback,
        wouldRecommend,
        wouldReturn,
      } = body;

      if (!employeeId) {
        return NextResponse.json({ success: false, error: 'employeeId is required' }, { status: 400 });
      }

      if (satisfactionRating == null || !reasonForLeaving) {
        return NextResponse.json(
          { success: false, error: 'satisfactionRating and reasonForLeaving are required' },
          { status: 400 }
        );
      }

      if (satisfactionRating < 1 || satisfactionRating > 5) {
        return NextResponse.json(
          { success: false, error: 'satisfactionRating must be between 1 and 5' },
          { status: 400 }
        );
      }

      const db = await getCVisionDb(tenantId);

      const interview = {
        conductedBy: userId,
        conductedAt: new Date(),
        satisfactionRating: Number(satisfactionRating),
        reasonForLeaving: reasonForLeaving || '',
        feedback: feedback || '',
        wouldRecommend: Boolean(wouldRecommend),
        wouldReturn: Boolean(wouldReturn),
      };

      await saveExitInterview(db, tenantId, employeeId, interview);

      const auditCtx = createCVisionAuditContext({ userId, role, tenantId, user }, request);
      await logCVisionAudit(auditCtx, 'offboarding_exit_interview', 'employee', {
        resourceId: employeeId,
        metadata: { satisfactionRating, reasonForLeaving },
      });

      return NextResponse.json({
        success: true,
        data: interview,
        message: 'Exit interview saved',
      });
    } catch (error: any) {
      logger.error('[CVision Exit Interview POST]', error?.message || String(error));
      return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);
