import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Smart Scheduling API
 * GET  /api/cvision/schedules - Fetch schedules, shifts, weekly/monthly views
 * POST /api/cvision/schedules - Update entries, create overtime, approval flow
 *
 * Role-based access:
 *  ADMIN / HR          → all units & employees
 *  NURSING_MANAGER     → units in their department
 *  HEAD_NURSE          → their own unit only
 *  EMPLOYEE            → their own unit only (read-only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { ObjectId } from '@/lib/cvision/infra/mongo-compat';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { ShiftType } from '@/lib/cvision/scheduling/types';
import { DEFAULT_SHIFTS } from '@/lib/cvision/scheduling/shifts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Role helpers ─────────────────────────────────────────────
const ADMIN_ROLES = ['admin', 'hr-admin', 'hr-manager', 'super-admin', 'owner', 'thea-owner'];
function isAdminOrHR(role: string): boolean {
  if (!role) return false;
  return ADMIN_ROLES.includes(role.toLowerCase());
}

// Safe ObjectId check — UUID strings are NOT valid ObjectIds
function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

// Build employee query that handles both `id` (UUID) and `_id` (ObjectId)
function employeeByIdQuery(tenantId: string, employeeId: string) {
  const query: any = { tenantId, deletedAt: null, id: employeeId };
  if (isValidObjectId(employeeId)) {
    query.$or = [{ id: employeeId }, { _id: new ObjectId(employeeId) }];
    delete query.id;
  }
  return query;
}

// Resolve the current user's employee record
async function resolveCurrentEmployee(db: any, tenantId: string, userId: string) {
  return db.collection('cvision_employees')
    .findOne({ tenantId, userId, deletedAt: null });
}

// Resolve which unit IDs the current user can see (null = all)
async function resolveAllowedUnitIds(
  db: any,
  tenantId: string,
  role: string,
  userId: string
): Promise<string[] | null> {
  if (isAdminOrHR(role)) return null; // all units

  const currentUser = await resolveCurrentEmployee(db, tenantId, userId);
  if (!currentUser) return [];

  const empId = currentUser.id || currentUser._id?.toString();
  const nursingRole = currentUser.nursingRole || null;

  if (nursingRole === 'NURSING_MANAGER') {
    // Units where they are nursingManagerId OR in their department
    const unitsQuery: any = {
      tenantId,
      isActive: { $ne: false },
      $or: [
        { nursingManagerId: empId },
        ...(currentUser.departmentId
          ? [{ departmentId: currentUser.departmentId }]
          : []),
      ],
    };
    const units = await db.collection('cvision_units').find(unitsQuery).limit(500).toArray();
    return units.map((u: any) => u.id || u._id?.toString());
  }

  if (nursingRole === 'HEAD_NURSE') {
    // Units where they are headNurseId
    const units = await db.collection('cvision_units')
      .find({ tenantId, headNurseId: empId, isActive: { $ne: false } })
      .toArray();
    return units.map((u: any) => u.id || u._id?.toString());
  }

  // Regular employee — their unit only
  if (currentUser.unitId) {
    return [currentUser.unitId];
  }

  return [];
}

// ─── GET /api/cvision/schedules ─────────────────────────────────

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId, userId, role }) => {
    try {
      const { searchParams } = new URL(request.url);
      const departmentId = searchParams.get('departmentId');
      const unitId = searchParams.get('unitId');
      const status = searchParams.get('status');
      const type = searchParams.get('type');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const action = searchParams.get('action');

      const db = await getCVisionDb(tenantId);

      // ── Resolve role-based unit access ──────────────────────
      const allowedUnitIds = await resolveAllowedUnitIds(db, tenantId, role, userId);
      logger.info('[CVision Schedules] Role:', role, '| isAdminOrHR:', isAdminOrHR(role), '| allowedUnitIds:', allowedUnitIds, '| unitId param:', unitId, '| departmentId param:', departmentId);

      // If allowedUnitIds is empty array, user has no access
      if (allowedUnitIds !== null && allowedUnitIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: action === 'shifts' ? [] : { schedule: [], shifts: [], summary: null },
        });
      }

      // Determine effective unit filter
      const effectiveUnitIds = (() => {
        if (unitId) {
          // Explicit unitId filter — verify user has access
          if (allowedUnitIds !== null && !allowedUnitIds.includes(unitId)) {
            return []; // No access to this unit
          }
          return [unitId];
        }
        return allowedUnitIds; // null = all, or specific array
      })();

      // If explicit unit was requested but user doesn't have access
      if (Array.isArray(effectiveUnitIds) && effectiveUnitIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: action === 'shifts' ? [] : { schedule: [], shifts: [], summary: null },
        });
      }

      // ── Action: shifts ────────────────────────────────────────
      if (action === 'shifts') {
        let shifts = await db.collection('cvision_shifts')
          .find({ tenantId, isActive: true })
          .toArray();

        // Seed defaults if empty
        if (shifts.length === 0) {
          const defaultShifts = DEFAULT_SHIFTS.map(shift => ({
            ...shift,
            id: new ObjectId().toString(),
            tenantId,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

          await db.collection('cvision_shifts').insertMany(defaultShifts);
          shifts = defaultShifts as Record<string, unknown>[];
        }

        return NextResponse.json({
          success: true,
          data: shifts,
        });
      }

      // ── Action: weekly / monthly view ─────────────────────────
      if (action === 'weekly' || action === 'monthly') {
        const start = startDate ? new Date(startDate) : getWeekStart(new Date());
        const end = endDate ? new Date(endDate) : getWeekEnd(start);

        // Fetch active employees with unit + role filtering
        const employeeQuery: any = {
          tenantId,
          status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] },
          deletedAt: null,
        };

        // Department filter
        if (departmentId && departmentId !== 'all') {
          employeeQuery.departmentId = departmentId;
        }

        // Unit filter (optional — only apply if explicitly requested)
        if (unitId && unitId !== 'all') {
          employeeQuery.unitId = unitId;
        } else if (!isAdminOrHR(role) && effectiveUnitIds !== null) {
          // Non-admin users: restrict to their allowed units
          employeeQuery.unitId = { $in: effectiveUnitIds };
        }
        // Admin/HR with no unit filter → fetch ALL employees (no unitId restriction)

        logger.info('[CVision Schedules] Employee Query:', JSON.stringify(employeeQuery));

        const empProjection = {
          id: 1, firstName: 1, lastName: 1, employeeNo: 1, employeeNumber: 1,
          departmentId: 1, unitId: 1, jobTitleId: 1, nursingRole: 1,
        };

        let primaryEmployees = await db.collection('cvision_employees')
          .find(employeeQuery)
          .project(empProjection)
          .toArray();

        // ── Assignment-aware employee list ────────────────────────
        const targetUnitId = (unitId && unitId !== 'all') ? unitId : null;

        let borrowedEmployees: any[] = [];

        // ── PULL_OUT filtering (applies to ALL views) ──────────────
        // Always fetch active PULL_OUT assignments so pulled-out employees
        // are excluded regardless of whether a specific unit is selected
        const allPullOutAssignments = await db.collection('cvision_assignments')
          .find({
            tenantId,
            status: 'ACTIVE',
            assignmentType: 'PULL_OUT',
            deletedAt: null,
          })
          .project({ employeeId: 1, originalUnitId: 1, assignedUnitId: 1, pullOutType: 1 })
          .toArray();

        const pullOutMap = new Map(
          allPullOutAssignments.map((a: any) => [a.employeeId, a])
        );

        // Remove pulled-out employees from primary list
        if (pullOutMap.size > 0) {
          primaryEmployees = primaryEmployees.filter((e: any) => {
            const eid = e.id || e._id?.toString();
            const pullOut = pullOutMap.get(eid);
            if (!pullOut) return true; // Not pulled out — keep

            // If viewing a specific unit and employee is TRANSFERRED here, keep them
            if (targetUnitId && pullOut.assignedUnitId === targetUnitId) {
              return true;
            }

            // Otherwise pulled out — remove from this view
            return false;
          });
        }

        // For TRANSFER type: re-add employee under destination unit
        // This runs for ALL views (all depts, specific dept, specific unit)
        if (pullOutMap.size > 0) {
          const transferAssignments = allPullOutAssignments
            .filter((a: any) => a.assignedUnitId && a.pullOutType === 'TRANSFER');

          // If viewing a specific unit, only include transfers TO that unit
          const relevantTransfers = targetUnitId
            ? transferAssignments.filter((a: any) => a.assignedUnitId === targetUnitId)
            : transferAssignments;

          const transferredEmpIds = relevantTransfers.map((a: any) => a.employeeId);

          if (transferredEmpIds.length > 0) {
            // Look up destination unit departmentIds so we can override the employee's departmentId
            const destUnitIds = [...new Set(relevantTransfers
              .map((a: any) => a.assignedUnitId))] as string[];

            let destUnitDeptMap = new Map<string, string>();
            if (destUnitIds.length > 0) {
              const destUnits = await db.collection('cvision_units')
                .find({ tenantId, id: { $in: destUnitIds } })
                .project({ id: 1, departmentId: 1 })
                .toArray();
              destUnitDeptMap = new Map(destUnits.map((u: any) => [u.id, u.departmentId]));
            }

            // If viewing a specific department, only include transfers whose destination is in that department
            const filteredTransferEmpIds = (departmentId && departmentId !== 'all')
              ? transferredEmpIds.filter((empId: string) => {
                  const pullOut = pullOutMap.get(empId);
                  if (!pullOut?.assignedUnitId) return false;
                  const destDeptId = destUnitDeptMap.get(pullOut.assignedUnitId);
                  return destDeptId === departmentId;
                })
              : transferredEmpIds;

            if (filteredTransferEmpIds.length > 0) {
              const transferredDocs = await db.collection('cvision_employees')
                .find({
                  tenantId,
                  deletedAt: null,
                  id: { $in: filteredTransferEmpIds },
                })
                .project(empProjection)
                .toArray();

              for (const emp of transferredDocs) {
                const eid = emp.id || emp._id?.toString();
                // Skip if already in primaryEmployees (e.g. when viewing destination unit directly)
                const alreadyInPrimary = primaryEmployees.some((p: any) => (p.id || p._id?.toString()) === eid);
                if (alreadyInPrimary) continue;

                const pullOut = pullOutMap.get(eid);
                if (pullOut?.assignedUnitId) {
                  borrowedEmployees.push({
                    ...emp,
                    unitId: pullOut.assignedUnitId, // Show under destination unit
                    departmentId: destUnitDeptMap.get(pullOut.assignedUnitId) || emp.departmentId, // Override to destination department
                    isBorrowed: true,
                    borrowedFrom: pullOut.originalUnitId,
                    assignmentType: 'PULL_OUT',
                  });
                }
              }
            }
          }
        }

        // ── Borrowed employees (LOAN/TRAINING/FLOAT) — specific unit only ──
        if (targetUnitId) {
          const activeAssignments = await db.collection('cvision_assignments')
            .find({
              tenantId,
              status: 'ACTIVE',
              deletedAt: null,
              assignedUnitId: targetUnitId,
              assignmentType: { $in: ['LOAN', 'TRAINING', 'FLOAT'] },
            })
            .toArray();

          if (activeAssignments.length > 0) {
            const borrowedEmpIds = activeAssignments.map((a: any) => a.employeeId);
            const borrowedDocs = await db.collection('cvision_employees')
              .find({
                tenantId,
                deletedAt: null,
                $or: [
                  { id: { $in: borrowedEmpIds } },
                  ...(borrowedEmpIds.some((eid: string) => isValidObjectId(eid))
                    ? [{ _id: { $in: borrowedEmpIds.filter((eid: string) => isValidObjectId(eid)).map((eid: string) => new ObjectId(eid)) } }]
                    : []),
                ],
              })
              .project(empProjection)
              .toArray();

            const borrowedIn = borrowedDocs.map((e: any) => {
              const eid = e.id || e._id?.toString();
              const assignment = activeAssignments.find((a: any) => a.employeeId === eid);
              return {
                ...e,
                isBorrowed: true,
                borrowedFrom: assignment?.originalUnitId || null,
                assignmentType: assignment?.assignmentType || null,
              };
            });

            borrowedEmployees = [...borrowedEmployees, ...borrowedIn];
          }

          logger.info('[CVision Schedules] Unit:', targetUnitId,
            '| Primary:', primaryEmployees.length,
            '| Borrowed in:', borrowedEmployees.length);
        }

        // Merge primary + borrowed employees
        const employees = [...primaryEmployees, ...borrowedEmployees];

        logger.info('[CVision Schedules] Total employees for schedule:', employees.length);

        // Batch lookup unit names (include borrowed-from units too)
        const empUnitIds = [...new Set([
          ...employees.map((e: any) => e.unitId),
          ...employees.map((e: any) => e.borrowedFrom),
        ].filter(Boolean))];
        const unitDocs = empUnitIds.length > 0
          ? await db.collection('cvision_units')
              .find({ tenantId, id: { $in: empUnitIds } })
              .project({ id: 1, name: 1, code: 1 })
              .toArray()
          : [];
        const unitMap = new Map(unitDocs.map((u: any) => [u.id, u]));

        // Fetch schedule entries for the period
        const entryQuery: any = {
          tenantId,
          date: { $gte: start, $lte: end },
        };
        if (departmentId) entryQuery.departmentId = departmentId;

        const entries = await db.collection('cvision_schedule_entries')
          .find(entryQuery)
          .toArray();

        // Fetch approved leaves overlapping the period
        const leaves = await db.collection('cvision_leaves')
          .find({
            tenantId,
            status: 'APPROVED',
            startDate: { $lte: end },
            endDate: { $gte: start },
          })
          .toArray();

        // Fetch shifts (seed if empty)
        let shifts = await db.collection('cvision_shifts')
          .find({ tenantId, isActive: true })
          .toArray();

        if (shifts.length === 0) {
          const defaultShifts = DEFAULT_SHIFTS.map(shift => ({
            ...shift,
            id: new ObjectId().toString(),
            tenantId,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));
          await db.collection('cvision_shifts').insertMany(defaultShifts);
          shifts = defaultShifts as Record<string, unknown>[];
        }

        // Build the schedule grid
        const days = getDaysInRange(start, end);
        const schedule = employees.map((emp: any) => {
          const empId = emp.id || emp._id?.toString();
          const employeeEntries = entries.filter((e: any) => e.employeeId === empId);
          const employeeLeaves = leaves.filter((l: any) => l.employeeId === empId);

          // Get unit info
          const empUnit = emp.unitId ? unitMap.get(emp.unitId) : null;

          return {
            employee: {
              id: empId,
              name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
              employeeNo: emp.employeeNo || emp.employeeNumber || '',
              departmentId: emp.departmentId,
              unitId: emp.unitId || null,
              unitName: empUnit?.name || null,
              unitCode: empUnit?.code || null,
              nursingRole: emp.nursingRole || null,
              isBorrowed: emp.isBorrowed || false,
              borrowedFrom: emp.borrowedFrom || null,
              originalUnitName: emp.borrowedFrom ? (unitMap.get(emp.borrowedFrom)?.name || null) : null,
              assignmentType: emp.assignmentType || null,
            },
            days: days.map(day => {
              // Check for existing entry
              const entry = employeeEntries.find((e: any) =>
                new Date(e.date).toDateString() === day.toDateString()
              );

              // Check for approved leave
              const leave = employeeLeaves.find((l: any) =>
                new Date(l.startDate) <= day && new Date(l.endDate) >= day
              );

              if (leave) {
                return {
                  date: day,
                  shiftType: 'LEAVE' as ShiftType,
                  leaveRequestId: leave.id || leave._id?.toString(),
                  leaveType: leave.leaveType || leave.type,
                };
              }

              if (entry) {
                return {
                  date: day,
                  shiftType: entry.shiftType,
                  shiftId: entry.shiftId,
                  entryId: entry.id || entry._id?.toString(),
                  overtimeHours: entry.overtimeHours,
                  notes: entry.notes,
                };
              }

              // Default: OFF for Fri/Sat, DAY for rest
              const dayOfWeek = day.getDay();
              const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

              return {
                date: day,
                shiftType: isWeekend ? ('OFF' as ShiftType) : ('DAY' as ShiftType),
                isDefault: true,
              };
            }),
          };
        });

        // Compute summary stats
        const summary = {
          totalEmployees: employees.length,
          shiftsCount: {
            DAY: 0,
            NIGHT: 0,
            EVENING: 0,
            OFF: 0,
            LEAVE: 0,
            OVERTIME: 0,
          } as Record<ShiftType, number>,
          daysInPeriod: days.length,
        };

        schedule.forEach((emp: any) => {
          emp.days.forEach((day: any) => {
            if (day.shiftType && summary.shiftsCount[day.shiftType] !== undefined) {
              summary.shiftsCount[day.shiftType]++;
            }
          });
        });

        // Fetch available units for filtering (based on user access)
        let availableUnits: any[] = [];
        if (allowedUnitIds === null) {
          // Admin sees all units
          availableUnits = await db.collection('cvision_units')
            .find({ tenantId, isActive: { $ne: false } })
            .project({ id: 1, name: 1, code: 1, departmentId: 1 })
            .sort({ name: 1 })
            .toArray();
        } else {
          availableUnits = unitDocs;
        }

        return NextResponse.json({
          success: true,
          data: {
            startDate: start,
            endDate: end,
            schedule,
            shifts,
            summary,
            availableUnits,
          },
        });
      }

      // ── Default: list schedules ───────────────────────────────
      const query: any = { tenantId, deletedAt: null };
      if (departmentId) query.departmentId = departmentId;
      if (unitId) query.unitId = unitId;
      if (status) query.status = status;
      if (type) query.type = type;

      // Apply unit-based access to schedule listing
      if (effectiveUnitIds !== null) {
        query.unitId = { $in: effectiveUnitIds };
      }

      const schedules = await db.collection('cvision_schedules')
        .find(query)
        .sort({ startDate: -1 })
        .limit(50)
        .toArray();

      return NextResponse.json({
        success: true,
        data: schedules,
      });
    } catch (error: any) {
      logger.error('[CVision Schedules GET]', error?.message || String(error));
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);

// ─── POST /api/cvision/schedules ────────────────────────────────

export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId, role }) => {
    try {
      const body = await request.json();
      const { action } = body;

      const db = await getCVisionDb(tenantId);

      // ── Action: update-entry ──────────────────────────────────
      if (action === 'update-entry') {
        const { employeeId, date, shiftType, shiftId, overtimeHours, notes } = body;

        if (!employeeId || !date || !shiftType) {
          return NextResponse.json(
            { success: false, error: 'employeeId, date, and shiftType are required' },
            { status: 400 }
          );
        }

        const entryDate = new Date(date);
        entryDate.setHours(0, 0, 0, 0);

        // Get employee info for departmentId + unitId
        const employee = await db.collection('cvision_employees')
          .findOne(employeeByIdQuery(tenantId, employeeId));

        // Upsert the schedule entry
        const existingEntry = await db.collection('cvision_schedule_entries')
          .findOne({ tenantId, employeeId, date: entryDate });

        const entryData = {
          tenantId,
          employeeId,
          departmentId: employee?.departmentId || null,
          unitId: employee?.unitId || null,
          date: entryDate,
          shiftType,
          shiftId: shiftId || null,
          overtimeHours: overtimeHours || null,
          notes: notes || null,
          isAutoGenerated: false,
          updatedAt: new Date(),
          updatedBy: userId,
        };

        if (existingEntry) {
          await db.collection('cvision_schedule_entries')
            .updateOne({ _id: existingEntry._id, tenantId }, { $set: entryData });
        } else {
          await db.collection('cvision_schedule_entries')
            .insertOne({
              ...entryData,
              id: new ObjectId().toString(),
              createdAt: new Date(),
              createdBy: userId,
            });
        }

        // Auto-create leave request if LEAVE shift and flag is set
        if (shiftType === 'LEAVE' && body.autoCreateLeave) {
          const existingLeave = await db.collection('cvision_leaves')
            .findOne({
              tenantId,
              employeeId,
              startDate: { $lte: entryDate },
              endDate: { $gte: entryDate },
              status: { $ne: 'REJECTED' },
            });

          if (!existingLeave) {
            await db.collection('cvision_leaves')
              .insertOne({
                id: new ObjectId().toString(),
                tenantId,
                employeeId,
                type: body.leaveType || 'ANNUAL',
                startDate: entryDate,
                endDate: entryDate,
                days: 1,
                status: 'PENDING',
                reason: body.leaveReason || 'Created from schedule',
                createdAt: new Date(),
                createdBy: userId,
                deletedAt: null,
              });
          }
        }

        return NextResponse.json({
          success: true,
          message: 'Schedule updated successfully',
        });
      }

      // ── Action: swap-shifts ──────────────────────────────────
      if (action === 'swap-shifts') {
        const { employeeId1, employeeId2, date: swapDate,
                entryId1, entryId2, shift1, shift2 } = body;
        if (!employeeId1 || !employeeId2 || !swapDate) {
          return NextResponse.json(
            { success: false, error: 'employeeId1, employeeId2, and date are required' },
            { status: 400 },
          );
        }

        const fromShift = shift1 || 'DAY';
        const toShift   = shift2 || 'DAY';

        if (fromShift === toShift) {
          return NextResponse.json({ success: true, message: 'Both employees have the same shift — nothing to swap' });
        }

        const col = db.collection('cvision_schedule_entries');
        const now = new Date();
        const entryDate = new Date(swapDate);
        entryDate.setHours(0, 0, 0, 0);

        // Date range covering any timezone representation of the same calendar day
        const dayRangeStart = new Date(entryDate.getTime() - 14 * 3600_000);
        const dayRangeEnd   = new Date(entryDate.getTime() + 38 * 3600_000);

        // Helper: find entry by entryId first, then fall back to date range
        async function findEntry(entryId: string | null, employeeId: string) {
          if (entryId) {
            const byId = await col.findOne({ tenantId, id: entryId });
            if (byId) return byId;
            if (ObjectId.isValid(entryId)) {
              const byOid = await col.findOne({ tenantId, _id: new ObjectId(entryId) });
              if (byOid) return byOid;
            }
          }
          // Fallback: find by employee + date range
          return col.findOne({
            tenantId, employeeId,
            date: { $gte: dayRangeStart, $lt: dayRangeEnd },
          });
        }

        const doc1 = await findEntry(entryId1, employeeId1);
        const doc2 = await findEntry(entryId2, employeeId2);

        // Give employee1 → employee2's shift (toShift)
        if (doc1) {
          await col.updateOne({ _id: doc1._id, tenantId }, {
            $set: { shiftType: toShift, updatedAt: now, updatedBy: userId },
          });
        } else {
          const emp1 = await db.collection('cvision_employees').findOne(employeeByIdQuery(tenantId, employeeId1));
          await col.insertOne({
            id: new ObjectId().toString(), tenantId, employeeId: employeeId1, date: entryDate,
            shiftType: toShift, shiftId: null, overtimeHours: null, notes: null,
            isAutoGenerated: false, createdAt: now, createdBy: userId, updatedAt: now,
            departmentId: emp1?.departmentId || null, unitId: emp1?.unitId || null,
          });
        }

        // Give employee2 → employee1's shift (fromShift)
        if (doc2) {
          await col.updateOne({ _id: doc2._id, tenantId }, {
            $set: { shiftType: fromShift, updatedAt: now, updatedBy: userId },
          });
        } else {
          const emp2 = await db.collection('cvision_employees').findOne(employeeByIdQuery(tenantId, employeeId2));
          await col.insertOne({
            id: new ObjectId().toString(), tenantId, employeeId: employeeId2, date: entryDate,
            shiftType: fromShift, shiftId: null, overtimeHours: null, notes: null,
            isAutoGenerated: false, createdAt: now, createdBy: userId, updatedAt: now,
            departmentId: emp2?.departmentId || null, unitId: emp2?.unitId || null,
          });
        }

        return NextResponse.json({ success: true, message: 'Shifts swapped successfully' });
      }

      // ── Action: cleanup-duplicate-entries ────────────────────
      if (action === 'cleanup-duplicate-entries') {
        const { startDate, endDate } = body;
        if (!startDate || !endDate) {
          return NextResponse.json({ success: false, error: 'startDate and endDate required' }, { status: 400 });
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        const col = db.collection('cvision_schedule_entries');

        const entries = await col.find({
          tenantId,
          date: { $gte: start, $lte: end },
        }).sort({ updatedAt: -1 }).limit(5000).toArray();

        // Group by employeeId + date (rounded to day)
        const seen = new Map<string, string>();
        const toDelete: any[] = [];
        for (const e of entries) {
          const d = new Date(e.date);
          const key = `${e.employeeId}::${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          if (seen.has(key)) {
            toDelete.push(e._id);
          } else {
            seen.set(key, e._id.toString());
          }
        }

        if (toDelete.length > 0) {
          await col.deleteMany({ _id: { $in: toDelete }, tenantId });
        }

        return NextResponse.json({
          success: true,
          message: `Removed ${toDelete.length} duplicate entries`,
          removed: toDelete.length,
        });
      }

      // ── Action: create-overtime ───────────────────────────────
      if (action === 'create-overtime') {
        const { employeeId, date, hours, reason } = body;

        if (!employeeId || !date || !hours) {
          return NextResponse.json(
            { success: false, error: 'employeeId, date, and hours are required' },
            { status: 400 }
          );
        }

        // Get employee salary info for pay calculation
        const employee = await db.collection('cvision_employees')
          .findOne(employeeByIdQuery(tenantId, employeeId));

        const profile = await db.collection('cvision_payroll_profiles')
          .findOne({ tenantId, employeeId });

        const baseSalary = profile?.baseSalary || employee?.basicSalary || 5000;
        const hourlyRate = baseSalary / (30 * 8);
        const overtimeDate = new Date(date);
        const dayOfWeek = overtimeDate.getDay();
        const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
        const rate = isWeekend ? 1.75 : 1.5;
        const amount = Math.round(hourlyRate * hours * rate);

        const overtime = {
          id: new ObjectId().toString(),
          tenantId,
          employeeId,
          unitId: employee?.unitId || null,
          date: overtimeDate,
          hours,
          rate,
          reason: reason || '',
          amount,
          status: 'PENDING',
          createdAt: new Date(),
          createdBy: userId,
          deletedAt: null,
        };

        await db.collection('cvision_overtime_requests').insertOne(overtime);

        // Update matching schedule entry if exists
        await db.collection('cvision_schedule_entries')
          .updateOne(
            { tenantId, employeeId, date: overtimeDate },
            { $set: { overtimeHours: hours, updatedAt: new Date() } }
          );

        return NextResponse.json({
          success: true,
          data: overtime,
          message: 'Overtime request created',
        });
      }

      // ── Action: submit-for-approval ───────────────────────────
      if (action === 'submit-for-approval') {
        const { scheduleId, unitId: submitUnitId, startDate: submitStart, endDate: submitEnd } = body;

        if (!scheduleId && !submitUnitId) {
          return NextResponse.json(
            { success: false, error: 'scheduleId or (unitId + startDate + endDate) are required' },
            { status: 400 }
          );
        }

        let schedule: any = null;
        let resolvedScheduleId = scheduleId;

        if (scheduleId) {
          // Lookup by scheduleId
          schedule = await db.collection('cvision_schedules')
            .findOne({ tenantId, id: scheduleId, deletedAt: null });

          if (!schedule) {
            return NextResponse.json(
              { success: false, error: 'Schedule not found' },
              { status: 404 }
            );
          }

          if (schedule.status !== 'DRAFT') {
            return NextResponse.json(
              { success: false, error: `Cannot submit schedule with status: ${schedule.status}` },
              { status: 400 }
            );
          }

          // Update schedule status
          await db.collection('cvision_schedules')
            .updateOne(
              { _id: schedule._id, tenantId },
              {
                $set: {
                  status: 'PENDING_APPROVAL',
                  submittedBy: userId,
                  submittedAt: new Date(),
                  updatedAt: new Date(),
                  updatedBy: userId,
                },
              }
            );
        } else {
          // Create from unitId + date range (no existing schedule doc needed)
          resolvedScheduleId = new ObjectId().toString();
        }

        // Verify unit exists if provided
        let unitDoc: any = null;
        const effectiveUnitId = submitUnitId || schedule?.unitId;
        if (effectiveUnitId) {
          unitDoc = await db.collection('cvision_units')
            .findOne({ tenantId, id: effectiveUnitId });
        }

        // Create approval record
        await db.collection('cvision_schedule_approvals')
          .insertOne({
            id: new ObjectId().toString(),
            tenantId,
            scheduleId: resolvedScheduleId,
            unitId: effectiveUnitId || null,
            unitName: unitDoc?.name || null,
            startDate: submitStart ? new Date(submitStart) : schedule?.startDate || null,
            endDate: submitEnd ? new Date(submitEnd) : schedule?.endDate || null,
            status: 'PENDING_APPROVAL',
            createdBy: schedule?.createdBy || userId,
            createdByRole: 'HEAD_NURSE',
            createdAt: new Date(),
            submittedBy: userId,
            submittedAt: new Date(),
          });

        return NextResponse.json({
          success: true,
          data: { approvalId: resolvedScheduleId },
          message: 'Schedule submitted for approval',
        });
      }

      // ── Action: approve-schedule ──────────────────────────────
      if (action === 'approve-schedule') {
        const { approvalId, scheduleId } = body;
        const lookupId = approvalId || scheduleId;

        if (!lookupId) {
          return NextResponse.json(
            { success: false, error: 'approvalId or scheduleId is required' },
            { status: 400 }
          );
        }

        // Find approval record (by id or scheduleId)
        const approval = await db.collection('cvision_schedule_approvals')
          .findOne({
            tenantId,
            $or: [{ id: lookupId }, { scheduleId: lookupId }],
          });

        if (!approval) {
          return NextResponse.json(
            { success: false, error: 'Approval record not found' },
            { status: 404 }
          );
        }

        if (approval.status !== 'PENDING_APPROVAL') {
          return NextResponse.json(
            { success: false, error: `Cannot approve with status: ${approval.status}` },
            { status: 400 }
          );
        }

        // Verify user is NURSING_MANAGER for this unit/department
        if (!isAdminOrHR(role)) {
          const currentUser = await resolveCurrentEmployee(db, tenantId, userId);
          const nursingRole = currentUser?.nursingRole || null;

          if (nursingRole !== 'NURSING_MANAGER') {
            return NextResponse.json(
              { success: false, error: 'Only the Nursing Manager can approve the schedule' },
              { status: 403 }
            );
          }

          // Verify manager has access to this unit
          const targetUnitId = approval.unitId;
          if (targetUnitId) {
            const unit = await db.collection('cvision_units')
              .findOne({ tenantId, id: targetUnitId });

            const empId = currentUser.id || currentUser._id?.toString();
            if (unit && unit.nursingManagerId !== empId && unit.departmentId !== currentUser.departmentId) {
              return NextResponse.json(
                { success: false, error: 'You do not have permission to approve this unit\'s schedule' },
                { status: 403 }
              );
            }
          }
        }

        // Update approval record
        await db.collection('cvision_schedule_approvals')
          .updateOne(
            { _id: approval._id, tenantId },
            {
              $set: {
                status: 'APPROVED',
                approvedBy: userId,
                approvedAt: new Date(),
              },
            }
          );

        // Also update schedule doc if it exists
        if (approval.scheduleId) {
          await db.collection('cvision_schedules')
            .updateOne(
              { tenantId, id: approval.scheduleId },
              {
                $set: {
                  status: 'APPROVED',
                  approvedBy: userId,
                  approvedAt: new Date(),
                  updatedAt: new Date(),
                  updatedBy: userId,
                },
              }
            );
        }

        return NextResponse.json({
          success: true,
          message: 'Schedule approved',
        });
      }

      // ── Action: reject-schedule ───────────────────────────────
      if (action === 'reject-schedule') {
        const { approvalId, scheduleId, rejectionReason } = body;
        const lookupId = approvalId || scheduleId;

        if (!lookupId) {
          return NextResponse.json(
            { success: false, error: 'approvalId or scheduleId is required' },
            { status: 400 }
          );
        }

        // Find approval record
        const approval = await db.collection('cvision_schedule_approvals')
          .findOne({
            tenantId,
            $or: [{ id: lookupId }, { scheduleId: lookupId }],
          });

        if (!approval) {
          return NextResponse.json(
            { success: false, error: 'Approval record not found' },
            { status: 404 }
          );
        }

        if (approval.status !== 'PENDING_APPROVAL') {
          return NextResponse.json(
            { success: false, error: `Cannot reject with status: ${approval.status}` },
            { status: 400 }
          );
        }

        // Verify user is NURSING_MANAGER
        if (!isAdminOrHR(role)) {
          const currentUser = await resolveCurrentEmployee(db, tenantId, userId);
          const nursingRole = currentUser?.nursingRole || null;

          if (nursingRole !== 'NURSING_MANAGER') {
            return NextResponse.json(
              { success: false, error: 'Only the Nursing Manager can reject the schedule' },
              { status: 403 }
            );
          }

          // Verify manager has access to this unit
          const targetUnitId = approval.unitId;
          if (targetUnitId) {
            const unit = await db.collection('cvision_units')
              .findOne({ tenantId, id: targetUnitId });

            const empId = currentUser.id || currentUser._id?.toString();
            if (unit && unit.nursingManagerId !== empId && unit.departmentId !== currentUser.departmentId) {
              return NextResponse.json(
                { success: false, error: 'You do not have permission to reject this unit\'s schedule' },
                { status: 403 }
              );
            }
          }
        }

        // Update approval record
        await db.collection('cvision_schedule_approvals')
          .updateOne(
            { _id: approval._id, tenantId },
            {
              $set: {
                status: 'REJECTED',
                rejectedBy: userId,
                rejectedAt: new Date(),
                rejectionReason: rejectionReason || '',
              },
            }
          );

        // Also update schedule doc if it exists
        if (approval.scheduleId) {
          await db.collection('cvision_schedules')
            .updateOne(
              { tenantId, id: approval.scheduleId },
              {
                $set: {
                  status: 'REJECTED',
                  rejectedBy: userId,
                  rejectedAt: new Date(),
                  rejectionReason: rejectionReason || '',
                  updatedAt: new Date(),
                  updatedBy: userId,
                },
              }
            );
        }

        return NextResponse.json({
          success: true,
          message: 'Schedule rejected',
        });
      }

      // ── Action: publish-schedule ──────────────────────────────
      if (action === 'publish-schedule') {
        const { approvalId, scheduleId } = body;
        const lookupId = approvalId || scheduleId;

        if (!lookupId) {
          return NextResponse.json(
            { success: false, error: 'approvalId or scheduleId is required' },
            { status: 400 }
          );
        }

        // Find approval record
        const approval = await db.collection('cvision_schedule_approvals')
          .findOne({
            tenantId,
            $or: [{ id: lookupId }, { scheduleId: lookupId }],
          });

        if (!approval) {
          return NextResponse.json(
            { success: false, error: 'Approval record not found' },
            { status: 404 }
          );
        }

        if (approval.status !== 'APPROVED') {
          return NextResponse.json(
            { success: false, error: 'Schedule must be approved before publishing' },
            { status: 400 }
          );
        }

        // Only ADMIN/HR or NURSING_MANAGER can publish
        if (!isAdminOrHR(role)) {
          const currentUser = await resolveCurrentEmployee(db, tenantId, userId);
          const nursingRole = currentUser?.nursingRole || null;

          if (nursingRole !== 'NURSING_MANAGER') {
            return NextResponse.json(
              { success: false, error: 'Only the Nursing Manager can publish the schedule' },
              { status: 403 }
            );
          }
        }

        // Update approval record
        await db.collection('cvision_schedule_approvals')
          .updateOne(
            { _id: approval._id, tenantId },
            {
              $set: {
                status: 'PUBLISHED',
                publishedBy: userId,
                publishedAt: new Date(),
              },
            }
          );

        // Also update schedule doc if it exists
        if (approval.scheduleId) {
          await db.collection('cvision_schedules')
            .updateOne(
              { tenantId, id: approval.scheduleId },
              {
                $set: {
                  status: 'PUBLISHED',
                  publishedBy: userId,
                  publishedAt: new Date(),
                  updatedAt: new Date(),
                  updatedBy: userId,
                },
              }
            );
        }

        return NextResponse.json({
          success: true,
          message: 'Schedule published',
        });
      }

      // ── Action: get-approvals ─────────────────────────────────
      if (action === 'get-approvals') {
        const { status: filterStatus, unitId: filterUnitId } = body;

        // Determine which units the user can see approvals for
        const allowedUnitIds = await resolveAllowedUnitIds(db, tenantId, role, userId);

        const approvalQuery: any = { tenantId };

        // Status filter
        if (filterStatus) {
          approvalQuery.status = filterStatus;
        }

        // Unit filter — intersect with allowed units
        if (filterUnitId) {
          if (allowedUnitIds !== null && !allowedUnitIds.includes(filterUnitId)) {
            return NextResponse.json({
              success: true,
              data: [],
              total: 0,
            });
          }
          approvalQuery.unitId = filterUnitId;
        } else if (allowedUnitIds !== null) {
          approvalQuery.unitId = { $in: allowedUnitIds };
        }

        const approvals = await db.collection('cvision_schedule_approvals')
          .find(approvalQuery)
          .sort({ submittedAt: -1 })
          .limit(50)
          .toArray();

        // Enrich with submitter names
        const submitterIds = [...new Set(approvals.map((a: any) => a.submittedBy).filter(Boolean))];
        const submitters = submitterIds.length > 0
          ? await db.collection('cvision_employees')
              .find({ tenantId, userId: { $in: submitterIds }, deletedAt: null })
              .project({ userId: 1, firstName: 1, lastName: 1 })
              .toArray()
          : [];
        const submitterMap = new Map(
          submitters.map((s: any) => [s.userId, `${s.firstName || ''} ${s.lastName || ''}`.trim()])
        );

        const enriched = approvals.map((a: any) => ({
          ...a,
          submittedByName: submitterMap.get(a.submittedBy) || null,
          approvedByName: a.approvedBy ? submitterMap.get(a.approvedBy) || null : null,
          rejectedByName: a.rejectedBy ? submitterMap.get(a.rejectedBy) || null : null,
        }));

        return NextResponse.json({
          success: true,
          data: enriched,
          total: enriched.length,
        });
      }

      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    } catch (error: any) {
      logger.error('[CVision Schedules POST]', error?.message || String(error));
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);

// ─── Helper Functions ───────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Saturday as week start (Saudi standard)
  const diff = d.getDate() - day - (day === 0 ? 1 : -(6 - day));
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(startDate: Date): Date {
  const d = new Date(startDate);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getDaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(start);

  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}
