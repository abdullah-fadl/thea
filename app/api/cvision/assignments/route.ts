import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Employee Assignments API
 * GET  /api/cvision/assignments               - List assignments (with filters)
 * POST /api/cvision/assignments               - Create, end, or cancel assignments
 *
 * Manages temporary employee assignments: LOAN, TRAINING, FLOAT
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  findById,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionShiftAssignment, CVisionEmployee, CVisionUnit } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Use CVisionShiftAssignment from types (aliased for local brevity)
type CVisionAssignment = CVisionShiftAssignment;

// ─── Validation Schemas ────────────────────────────────────────

const createAssignmentSchema = z.object({
  employeeId: z.string().min(1, 'employeeId is required'),
  originalUnitId: z.string().min(1, 'originalUnitId is required'),
  assignedUnitId: z.string().min(1).nullable().optional(),
  assignmentType: z.enum(['LOAN', 'TRAINING', 'FLOAT', 'PULL_OUT']),
  startDate: z.string().min(1, 'startDate is required'),
  endDate: z.string().min(1, 'endDate is required'),
  reason: z.string().max(500).optional(),
  hoursPerWeek: z.number().int().min(1).max(168).optional(),
});

// ─── Role helpers ──────────────────────────────────────────────

const ADMIN_ROLES = ['admin', 'hr-admin', 'hr-manager', 'super-admin', 'owner', 'thea-owner'];
function isAdminOrHR(role: string): boolean {
  if (!role) return false;
  return ADMIN_ROLES.includes(role.toLowerCase());
}

// ─── GET /api/cvision/assignments ──────────────────────────────

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId, userId, role }) => {
    try {
      const { searchParams } = new URL(request.url);
      const unitId = searchParams.get('unitId');
      const employeeId = searchParams.get('employeeId');
      const assignmentType = searchParams.get('assignmentType');
      const status = searchParams.get('status') || 'ACTIVE';
      const includeEmployeeInfo = searchParams.get('includeEmployeeInfo') === 'true';
      const targetUnitId = searchParams.get('targetUnitId'); // for available-employees

      const action = searchParams.get('action');
      const collection = await getCVisionCollection<CVisionAssignment>(tenantId, 'assignments');

      // ── Debug: dump all assignments + specific employee (dev only) ──
      if (action === 'debug') {
        if (process.env.NODE_ENV !== 'development') {
          return NextResponse.json(
            { success: false, error: 'Not found' },
            { status: 404 }
          );
        }

        const allAssignments = await collection.find({ tenantId }).limit(5000).toArray();
        const empCollection = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
        const allEmployees = await empCollection.find({ tenantId, deletedAt: null }).limit(5000).toArray();

        return NextResponse.json({
          success: true,
          totalAssignments: allAssignments.length,
          assignments: allAssignments,
          totalEmployees: allEmployees.length,
          employees: allEmployees.map((e) => ({
            id: e.id || e._id?.toString(),
            name: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
            unitId: e.unitId || null,
            primaryUnitId: e.primaryUnitId || null,
            departmentId: e.departmentId || null,
            status: e.status,
          })),
        });
      }

      // ── Available employees for a unit ──────────────────────
      if (targetUnitId) {
        return await getAvailableEmployees(tenantId, targetUnitId, collection);
      }

      // ── List assignments ────────────────────────────────────
      const filter: any = { tenantId, deletedAt: null };

      if (unitId) {
        // Show assignments TO this unit or FROM this unit
        filter.$or = [
          { assignedUnitId: unitId },
          { originalUnitId: unitId },
        ];
      }

      if (employeeId) {
        filter.employeeId = employeeId;
      }

      if (assignmentType) {
        filter.assignmentType = assignmentType;
      }

      if (status && status !== 'all') {
        filter.status = status;
      }

      const assignments = await collection
        .find(filter)
        .sort({ startDate: -1 })
        .limit(100)
        .toArray();

      // ── Enrich with employee & unit info ────────────────────
      if (includeEmployeeInfo && assignments.length > 0) {
        const empIds = [...new Set(assignments.map(a => a.employeeId))];
        const unitIds = [...new Set([
          ...assignments.map(a => a.originalUnitId),
          ...assignments.map(a => a.assignedUnitId).filter(Boolean),
        ])];

        const empCollection = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
        const unitCollection = await getCVisionCollection<CVisionUnit>(tenantId, 'units');

        const [employees, units] = await Promise.all([
          empCollection.find({ tenantId, id: { $in: empIds }, deletedAt: null })
            .project({ id: 1, firstName: 1, lastName: 1, employeeNo: 1, employeeNumber: 1 })
            .toArray(),
          unitCollection.find({ tenantId, id: { $in: unitIds } })
            .project({ id: 1, name: 1, nameAr: 1, code: 1 })
            .toArray(),
        ]);

        const empMap = new Map(employees.map((e) => [e.id, e]));
        const unitMap = new Map(units.map((u) => [u.id, u]));

        const enriched = assignments.map(a => {
          const emp = empMap.get(a.employeeId);
          const origUnit = unitMap.get(a.originalUnitId);
          const assignedUnit = unitMap.get(a.assignedUnitId);

          return {
            ...a,
            employeeName: emp
              ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim()
              : null,
            employeeNo: emp?.employeeNo || emp?.employeeNumber || null,
            originalUnitName: origUnit?.name || null,
            originalUnitCode: origUnit?.code || null,
            assignedUnitName: assignedUnit?.name || null,
            assignedUnitCode: assignedUnit?.code || null,
          };
        });

        return NextResponse.json({ success: true, data: enriched });
      }

      return NextResponse.json({ success: true, data: assignments });
    } catch (error: any) {
      logger.error('[CVision Assignments GET]', error?.message || String(error));
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.SCHEDULING_READ }
);

// ─── POST /api/cvision/assignments ─────────────────────────────

export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const { action } = body;

      const collection = await getCVisionCollection<CVisionAssignment>(tenantId, 'assignments');
      const auditCtx = createCVisionAuditContext({ userId, role, tenantId, user }, request);

      // ── Pull Out (dedicated handler) ────────────────────────
      if (action === 'pull-out' || (action === 'create' && body.pullOutType)) {
        const {
          employeeId,
          originalUnitId,
          destinationUnitId,
          pullOutType,
          startDate,
          expectedReturnDate,
          reason,
        } = body;

        if (!employeeId || !originalUnitId || !pullOutType || !startDate) {
          return NextResponse.json(
            { success: false, error: 'employeeId, originalUnitId, pullOutType, and startDate are required' },
            { status: 400 }
          );
        }

        // Validate employee exists
        const empCollection = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
        const employee = await empCollection.findOne(
          createTenantFilter(tenantId, { id: employeeId })
        );
        if (!employee) {
          return NextResponse.json(
            { success: false, error: 'Employee not found' },
            { status: 404 }
          );
        }

        // Validate original unit exists
        const unitCollection = await getCVisionCollection<CVisionUnit>(tenantId, 'units');
        const origUnit = await unitCollection.findOne(
          createTenantFilter(tenantId, { id: originalUnitId })
        );
        if (!origUnit) {
          return NextResponse.json(
            { success: false, error: 'Original unit not found' },
            { status: 404 }
          );
        }

        // If TRANSFER, validate destination unit
        if (pullOutType === 'TRANSFER') {
          if (!destinationUnitId) {
            return NextResponse.json(
              { success: false, error: 'destinationUnitId is required for TRANSFER' },
              { status: 400 }
            );
          }
          const destUnit = await unitCollection.findOne(
            createTenantFilter(tenantId, { id: destinationUnitId })
          );
          if (!destUnit) {
            return NextResponse.json(
              { success: false, error: 'Destination unit not found' },
              { status: 404 }
            );
          }
        }

        // Check for overlapping active PULL_OUT
        const overlap = await collection.findOne({
          tenantId,
          employeeId,
          originalUnitId,
          assignmentType: 'PULL_OUT',
          status: 'ACTIVE',
          deletedAt: null,
        });
        if (overlap) {
          return NextResponse.json(
            { success: false, error: 'Employee already has an active pull-out from this unit' },
            { status: 409 }
          );
        }

        const now = new Date();
        const assignment = {
          id: uuidv4(),
          tenantId,
          employeeId,
          originalUnitId,
          assignedUnitId: destinationUnitId || null,
          assignmentType: 'PULL_OUT' as const,
          pullOutType,
          startDate: new Date(startDate),
          endDate: expectedReturnDate ? new Date(expectedReturnDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
          reason: reason || `Pull out: ${pullOutType}`,
          status: 'ACTIVE' as const,
          requestedBy: userId,
          requestedAt: now,
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
        };

        await collection.insertOne(assignment);

        await logCVisionAudit(auditCtx, 'assignment_create', 'assignment', {
          resourceId: assignment.id,
          changes: {
            after: {
              employeeId,
              type: 'PULL_OUT',
              pullOutType,
              from: originalUnitId,
              to: destinationUnitId || null,
            },
          },
        });

        return NextResponse.json(
          { success: true, assignment },
          { status: 201 }
        );
      }

      // ── Fix transfer (patch assignedUnitId on existing record) ─
      if (action === 'fix-transfer') {
        const { assignmentId, destinationUnitId: destUnitId } = body;
        if (!assignmentId || !destUnitId) {
          return NextResponse.json(
            { success: false, error: 'assignmentId and destinationUnitId are required' },
            { status: 400 }
          );
        }

        const result = await collection.updateOne(
          createTenantFilter(tenantId, { id: assignmentId }),
          { $set: { assignedUnitId: destUnitId, updatedAt: new Date(), updatedBy: userId } }
        );

        return NextResponse.json({
          success: true,
          message: 'Assignment updated',
          modifiedCount: result.modifiedCount,
        });
      }

      // ── Create assignment ───────────────────────────────────
      if (!action || action === 'create') {
        const data = createAssignmentSchema.parse(body);

        // For non-PULL_OUT types, assignedUnitId is required
        if (data.assignmentType !== 'PULL_OUT' && !data.assignedUnitId) {
          return NextResponse.json(
            { success: false, error: 'assignedUnitId is required' },
            { status: 400 }
          );
        }

        // Validate: originalUnitId !== assignedUnitId (skip for PULL_OUT)
        if (data.assignmentType !== 'PULL_OUT' && data.originalUnitId === data.assignedUnitId) {
          return NextResponse.json(
            { success: false, error: 'Cannot assign employee to their own unit' },
            { status: 400 }
          );
        }

        // Validate: employee exists
        const empCollection = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
        const employee = await empCollection.findOne(
          createTenantFilter(tenantId, { id: data.employeeId })
        );
        if (!employee) {
          return NextResponse.json(
            { success: false, error: 'Employee not found' },
            { status: 404 }
          );
        }

        // Validate: units exist
        const unitCollection = await getCVisionCollection<CVisionUnit>(tenantId, 'units');
        const origUnit = await unitCollection.findOne(
          createTenantFilter(tenantId, { id: data.originalUnitId })
        );
        if (!origUnit) {
          return NextResponse.json(
            { success: false, error: 'Original unit not found' },
            { status: 404 }
          );
        }

        // For non-PULL_OUT, also validate assigned unit
        let assignedUnit = null;
        if (data.assignmentType !== 'PULL_OUT') {
          assignedUnit = await unitCollection.findOne(
            createTenantFilter(tenantId, { id: data.assignedUnitId })
          );
          if (!assignedUnit) {
            return NextResponse.json(
              { success: false, error: 'Assigned unit not found' },
              { status: 404 }
            );
          }
        }

        // Check for overlapping active assignments
        const overlapFilter: any = {
          tenantId,
          employeeId: data.employeeId,
          status: 'ACTIVE',
          deletedAt: null,
        };
        if (data.assignmentType === 'PULL_OUT') {
          overlapFilter.assignmentType = 'PULL_OUT';
          overlapFilter.originalUnitId = data.originalUnitId;
        } else {
          overlapFilter.assignedUnitId = data.assignedUnitId;
        }
        const overlap = await collection.findOne(overlapFilter);

        if (overlap) {
          return NextResponse.json(
            { success: false, error: 'Employee already has an active assignment to this unit' },
            { status: 409 }
          );
        }

        const now = new Date();
        const assignment: CVisionAssignment = {
          id: uuidv4(),
          tenantId,
          employeeId: data.employeeId,
          originalUnitId: data.originalUnitId,
          assignedUnitId: data.assignmentType === 'PULL_OUT' ? null : data.assignedUnitId!,
          assignmentType: data.assignmentType,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          reason: data.reason,
          hoursPerWeek: data.hoursPerWeek,
          status: 'ACTIVE',
          requestedBy: userId,
          requestedAt: now,
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
        };

        await collection.insertOne(assignment);

        await logCVisionAudit(auditCtx, 'assignment_create', 'assignment', {
          resourceId: assignment.id,
          changes: {
            after: {
              employeeId: data.employeeId,
              type: data.assignmentType,
              from: data.originalUnitId,
              to: data.assignedUnitId,
            },
          },
        });

        return NextResponse.json(
          { success: true, assignment },
          { status: 201 }
        );
      }

      // ── End assignment ──────────────────────────────────────
      if (action === 'end') {
        const { assignmentId } = body;
        if (!assignmentId) {
          return NextResponse.json(
            { success: false, error: 'assignmentId is required' },
            { status: 400 }
          );
        }

        const existing = await findById(collection, tenantId, assignmentId);
        if (!existing) {
          return NextResponse.json(
            { success: false, error: 'Assignment not found' },
            { status: 404 }
          );
        }

        if (existing.status !== 'ACTIVE') {
          return NextResponse.json(
            { success: false, error: `Cannot end assignment with status: ${existing.status}` },
            { status: 400 }
          );
        }

        const now = new Date();
        await collection.updateOne(
          createTenantFilter(tenantId, { id: assignmentId }),
          {
            $set: {
              status: 'COMPLETED',
              endDate: now,
              updatedAt: now,
              updatedBy: userId,
            },
          }
        );

        await logCVisionAudit(auditCtx, 'assignment_end', 'assignment', {
          resourceId: assignmentId,
          changes: {
            before: { status: existing.status },
            after: { status: 'COMPLETED', endDate: now },
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Assignment ended successfully',
        });
      }

      // ── Cancel assignment ───────────────────────────────────
      if (action === 'cancel') {
        const { assignmentId } = body;
        if (!assignmentId) {
          return NextResponse.json(
            { success: false, error: 'assignmentId is required' },
            { status: 400 }
          );
        }

        const existing = await findById(collection, tenantId, assignmentId);
        if (!existing) {
          return NextResponse.json(
            { success: false, error: 'Assignment not found' },
            { status: 404 }
          );
        }

        if (existing.status !== 'ACTIVE') {
          return NextResponse.json(
            { success: false, error: `Cannot cancel assignment with status: ${existing.status}` },
            { status: 400 }
          );
        }

        const now = new Date();
        await collection.updateOne(
          createTenantFilter(tenantId, { id: assignmentId }),
          {
            $set: {
              status: 'CANCELLED',
              updatedAt: now,
              updatedBy: userId,
            },
          }
        );

        await logCVisionAudit(auditCtx, 'assignment_cancel', 'assignment', {
          resourceId: assignmentId,
          changes: {
            before: { status: existing.status },
            after: { status: 'CANCELLED' },
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Assignment cancelled successfully',
        });
      }

      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}` },
        { status: 400 }
      );
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { success: false, error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Assignments POST]', error?.message || String(error));
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.SCHEDULING_WRITE }
);

// ─── Helper: Get available employees for assignment ────────────

async function getAvailableEmployees(
  tenantId: string,
  targetUnitId: string,
  assignmentCollection: Awaited<ReturnType<typeof getCVisionCollection<CVisionAssignment>>>
) {
  try {
    const empCollection = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
    const unitCollection = await getCVisionCollection<CVisionUnit>(tenantId, 'units');

    // Get the target unit to know the department
    const targetUnit = await unitCollection.findOne(
      createTenantFilter(tenantId, { id: targetUnitId })
    );
    if (!targetUnit) {
      return NextResponse.json(
        { success: false, error: 'Target unit not found' },
        { status: 404 }
      );
    }

    // Get employees NOT in this unit, who are ACTIVE
    const employees = await empCollection
      .find({
        tenantId,
        status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] },
        deletedAt: null,
        $or: [
          { unitId: { $ne: targetUnitId } },
          { unitId: null },
          { unitId: { $exists: false } },
        ],
      })
      .project({
        id: 1,
        firstName: 1,
        lastName: 1,
        employeeNo: 1,
        employeeNumber: 1,
        departmentId: 1,
        unitId: 1,
        nursingRole: 1,
      })
      .sort({ firstName: 1 })
      .limit(200)
      .toArray();

    // Get active assignments for these employees
    const empIds = employees.map((e) => e.id);
    const activeAssignments = empIds.length > 0
      ? await assignmentCollection
          .find({
            tenantId,
            employeeId: { $in: empIds },
            status: 'ACTIVE',
            deletedAt: null,
          })
          .toArray()
      : [];

    // Build a map of employee -> active assignments
    const assignmentMap = new Map<string, CVisionAssignment[]>();
    for (const a of activeAssignments) {
      const list = assignmentMap.get(a.employeeId) || [];
      list.push(a);
      assignmentMap.set(a.employeeId, list);
    }

    // Get unit names for enrichment
    const unitIds = [...new Set(employees.map((e) => e.unitId).filter(Boolean))];
    const units = unitIds.length > 0
      ? await unitCollection
          .find({ tenantId, id: { $in: unitIds } })
          .project({ id: 1, name: 1, code: 1 })
          .toArray()
      : [];
    const unitMap = new Map(units.map((u) => [u.id, u]));

    // Categorize employees
    const result = employees.map((emp) => {
      const empUnit = emp.unitId ? unitMap.get(emp.unitId) : null;
      const empAssignments = assignmentMap.get(emp.id) || [];
      const isAlreadyAssignedToTarget = empAssignments.some(
        (a) => a.assignedUnitId === targetUnitId
      );

      // Determine availability category
      let category: 'SAME_DEPARTMENT' | 'FLOAT_POOL' | 'OTHER_DEPARTMENT' | 'CROSS_TRAINED';

      if (emp.nursingRole === 'FLOAT' || emp.isFloatPool) {
        category = 'FLOAT_POOL';
      } else if (empAssignments.some((a) => a.assignmentType === 'TRAINING')) {
        category = 'CROSS_TRAINED';
      } else if (emp.departmentId === targetUnit.departmentId) {
        category = 'SAME_DEPARTMENT';
      } else {
        category = 'OTHER_DEPARTMENT';
      }

      return {
        id: emp.id,
        name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
        employeeNo: emp.employeeNo || emp.employeeNumber || '',
        departmentId: emp.departmentId,
        unitId: emp.unitId,
        unitName: empUnit?.name || null,
        unitCode: empUnit?.code || null,
        nursingRole: emp.nursingRole || null,
        category,
        activeAssignments: empAssignments.length,
        isAlreadyAssignedToTarget,
      };
    });

    // Filter out those already assigned to this unit
    const available = result.filter((e) => !e.isAlreadyAssignedToTarget);

    // Sort: Float Pool first, then same department, then cross-trained, then others
    const categoryOrder: Record<string, number> = {
      FLOAT_POOL: 0,
      SAME_DEPARTMENT: 1,
      CROSS_TRAINED: 2,
      OTHER_DEPARTMENT: 3,
    };
    available.sort((a, b) =>
      (categoryOrder[a.category] ?? 9) - (categoryOrder[b.category] ?? 9)
    );

    return NextResponse.json({
      success: true,
      data: available,
      meta: {
        targetUnitId,
        targetUnitName: targetUnit.name,
        totalAvailable: available.length,
      },
    });
  } catch (error: any) {
    logger.error('[CVision Assignments Available]', error?.message || String(error));
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
