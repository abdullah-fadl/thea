import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Offboarding API
 * GET  /api/cvision/offboarding - List offboarding processes
 * POST /api/cvision/offboarding - Initiate offboarding for an employee
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { logCVisionAudit, createCVisionAuditContext } from '@/lib/cvision/audit';
import {
  initiateOffboarding,
  getAllOffboardings,
  completeOffboarding,
} from '@/lib/cvision/employees/offboarding-engine';

export const dynamic = 'force-dynamic';

// GET - List offboarding processes
export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status') || undefined;
      const employeeId = searchParams.get('employeeId');

      const db = await getCVisionDb(tenantId);

      if (employeeId) {
        // Get specific employee's offboarding
        const process = await db.collection('cvision_offboarding').findOne({
          tenantId, employeeId,
        });
        if (!process) return NextResponse.json({ success: false, error: 'No offboarding found' }, { status: 404 });

        const emp = await db.collection('cvision_employees').findOne({ tenantId, id: employeeId });
        return NextResponse.json({
          success: true,
          data: {
            ...process,
            employeeName: emp ? `${(emp as any).firstName || ''} ${(emp as any).lastName || ''}`.trim() : null,
          },
        });
      }

      const processes = await getAllOffboardings(db, tenantId, status);

      // Enrich with employee names
      const empIds = [...new Set(processes.map((p: any) => p.employeeId))];
      const employees = empIds.length > 0
        ? await db.collection('cvision_employees').find({ tenantId, id: { $in: empIds } }).project({ id: 1, firstName: 1, lastName: 1, employeeNumber: 1 }).toArray()
        : [];
      const empMap = new Map(employees.map((e: any) => [e.id, e]));

      const enriched = processes.map((p: any) => {
        const emp = empMap.get(p.employeeId);
        const completedCount = (p.checklist || []).filter((c: any) => c.status === 'COMPLETED').length;
        return {
          ...p,
          employeeName: emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : null,
          employeeNumber: emp?.employeeNumber,
          checklistProgress: {
            completed: completedCount,
            total: (p.checklist || []).length,
            percent: (p.checklist || []).length > 0 ? Math.round((completedCount / (p.checklist || []).length) * 100) : 0,
          },
        };
      });

      return NextResponse.json({ success: true, data: enriched, total: enriched.length });
    } catch (error: any) {
      logger.error('[CVision Offboarding GET]', error?.message || String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_STATUS }
);

// POST - Initiate offboarding or complete it
export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const { action = 'initiate' } = body;

      const db = await getCVisionDb(tenantId);
      const auditCtx = createCVisionAuditContext({ userId, role, tenantId, user }, request);

      if (action === 'initiate') {
        const { employeeId, type, reason, lastWorkingDay } = body;

        if (!employeeId || !type || !lastWorkingDay) {
          return NextResponse.json(
            { success: false, error: 'employeeId, type, and lastWorkingDay are required' },
            { status: 400 }
          );
        }

        const validTypes = ['RESIGNATION', 'TERMINATION', 'END_OF_CONTRACT', 'RETIREMENT', 'MUTUAL_AGREEMENT'];
        if (!validTypes.includes(type)) {
          return NextResponse.json(
            { success: false, error: `type must be one of: ${validTypes.join(', ')}` },
            { status: 400 }
          );
        }

        // Check employee exists and is active
        const employee = await db.collection('cvision_employees').findOne({ tenantId, id: employeeId, deletedAt: null });
        if (!employee) {
          return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
        }

        // Check no existing active offboarding
        const existing = await db.collection('cvision_offboarding').findOne({
          tenantId, employeeId, status: { $nin: ['COMPLETED'] },
        });
        if (existing) {
          return NextResponse.json({ success: false, error: 'Active offboarding already exists for this employee' }, { status: 409 });
        }

        const processId = await initiateOffboarding(db, tenantId, {
          employeeId, type, reason: reason || '', lastWorkingDay, initiatedBy: userId,
        });

        await logCVisionAudit(auditCtx, 'offboarding_initiate', 'employee', {
          resourceId: employeeId,
          metadata: { processId, type, lastWorkingDay },
        });

        return NextResponse.json({
          success: true,
          data: { processId, employeeId, type, status: 'INITIATED' },
          message: 'Offboarding initiated',
        }, { status: 201 });
      }

      if (action === 'complete') {
        const { employeeId } = body;
        if (!employeeId) {
          return NextResponse.json({ success: false, error: 'employeeId is required' }, { status: 400 });
        }

        await completeOffboarding(db, tenantId, employeeId);

        await logCVisionAudit(auditCtx, 'offboarding_complete', 'employee', {
          resourceId: employeeId,
        });

        return NextResponse.json({ success: true, message: 'Offboarding completed' });
      }

      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    } catch (error: any) {
      logger.error('[CVision Offboarding POST]', error?.message || String(error));
      return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_STATUS }
);
