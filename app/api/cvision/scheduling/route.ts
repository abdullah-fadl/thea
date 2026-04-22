import { logger } from '@/lib/monitoring/logger';
/**
 * Smart Scheduling API — Saudi Labor Law Compliant
 *
 * GET  /api/cvision/scheduling — templates, schedule, employee-schedule, overtime-report, conflicts, preferences, burnout-check
 * POST /api/cvision/scheduling — create-template, assign-shift, auto-generate, save-preference, swap, bulk-assign, cancel-assignment
 *
 * Separate from /api/cvision/schedules (existing basic grid API).
 * This API provides the labor-law-aware scheduling engine.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  listTemplates,
  createTemplate,
  seedDefaultTemplates,
  getWeekSchedule,
  getEmployeeSchedule,
  autoGenerateSchedule,
  validateSchedule,
  checkShiftAssignment,
  calculateOvertime,
  detectScheduleBurnout,
  swapShifts,
  getPreference,
  savePreference,
  cancelAssignment,
  isRamadanPeriod,
  SAUDI_LABOR_RULES,
} from '@/lib/cvision/scheduling/scheduling-engine';
import type { ShiftAssignment, ShiftTemplate } from '@/lib/cvision/scheduling/scheduling-engine';
import { generateAlerts, generateOvertimeReport } from '@/lib/cvision/scheduling/overtime-alerts';
import {
  getWorkSchedule,
  updateWorkSchedule,
  getDepartmentWorkSchedule,
  getAllDepartmentWorkSchedules,
  updateDepartmentWorkSchedule,
  deleteDepartmentWorkSchedule,
  resolveWorkSchedule,
} from '@/lib/cvision/admin-settings';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function ok(data: any) {
  return NextResponse.json({ success: true, data });
}
function fail(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

// ─── Role helpers (mirrors schedules/route.ts) ─────────────────────────────
const ADMIN_ROLES = ['admin', 'hr-admin', 'hr-manager', 'super-admin', 'owner', 'thea-owner'];
function isAdminOrHR(role: string): boolean {
  if (!role) return false;
  return ADMIN_ROLES.includes(role.toLowerCase());
}

async function resolveCurrentEmployee(db: any, tenantId: string, userId: string) {
  return db.collection('cvision_employees')
    .findOne({ tenantId, userId, deletedAt: null });
}

/**
 * Resolve which unit IDs and department IDs the user can access.
 * Returns { allowedUnitIds, allowedDepartmentIds }
 * null = all (admin), [] = none
 */
async function resolveAccess(db: any, tenantId: string, role: string, userId: string) {
  if (isAdminOrHR(role)) return { allowedUnitIds: null as string[] | null, allowedDepartmentIds: null as string[] | null };

  const currentUser = await resolveCurrentEmployee(db, tenantId, userId);
  if (!currentUser) return { allowedUnitIds: [] as string[], allowedDepartmentIds: [] as string[] };

  const empId = currentUser.id || currentUser._id?.toString();
  const nursingRole = currentUser.nursingRole || null;

  // NURSING_MANAGER / department manager: all units in their department
  if (nursingRole === 'NURSING_MANAGER') {
    const unitsQuery: any = {
      tenantId,
      isActive: { $ne: false },
      $or: [
        { nursingManagerId: empId },
        ...(currentUser.departmentId ? [{ departmentId: currentUser.departmentId }] : []),
      ],
    };
    const units = await db.collection('cvision_units').find(unitsQuery).limit(500).toArray();
    const unitIds = units.map((u: any) => u.id || u._id?.toString());
    const deptIds = currentUser.departmentId ? [currentUser.departmentId] : [];
    return { allowedUnitIds: unitIds, allowedDepartmentIds: deptIds };
  }

  // HEAD_NURSE: only their unit
  if (nursingRole === 'HEAD_NURSE') {
    const units = await db.collection('cvision_units')
      .find({ tenantId, headNurseId: empId, isActive: { $ne: false } })
      .toArray();
    const unitIds = units.map((u: any) => u.id || u._id?.toString());
    const deptIds = currentUser.departmentId ? [currentUser.departmentId] : [];
    return { allowedUnitIds: unitIds, allowedDepartmentIds: deptIds };
  }

  // MANAGER role: only their department
  if (role === 'manager' && currentUser.departmentId) {
    const units = await db.collection('cvision_units')
      .find({ tenantId, departmentId: currentUser.departmentId, isActive: { $ne: false } })
      .toArray();
    const unitIds = units.map((u: any) => u.id || u._id?.toString());
    return { allowedUnitIds: unitIds, allowedDepartmentIds: [currentUser.departmentId] };
  }

  // Regular employee: their unit only
  if (currentUser.unitId) {
    const deptIds = currentUser.departmentId ? [currentUser.departmentId] : [];
    return { allowedUnitIds: [currentUser.unitId], allowedDepartmentIds: deptIds };
  }

  return { allowedUnitIds: [] as string[], allowedDepartmentIds: [] as string[] };
}

// ─── GET ────────────────────────────────────────────────────────────────────

export const GET = withAuthTenant(async (request: NextRequest, { tenantId, userId, role }) => {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'templates';

  try {
    switch (action) {
      // ── Templates ──
      case 'templates': {
        const templates = await listTemplates(tenantId);
        if (templates.length === 0) {
          const seeded = await seedDefaultTemplates(tenantId);
          if (seeded > 0) {
            const fresh = await listTemplates(tenantId);
            return ok({ templates: fresh, seeded: true });
          }
        }
        return ok({ templates });
      }

      // ── Weekly Schedule ──
      case 'schedule': {
        const department = url.searchParams.get('department') || '';
        const weekStart = url.searchParams.get('weekStart');
        if (!weekStart) return fail('weekStart required');
        const week = await getWeekSchedule(tenantId, department, weekStart);
        return ok(week);
      }

      // ── Employee Schedule ──
      case 'employee-schedule': {
        const employeeId = url.searchParams.get('employeeId');
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        if (!employeeId || !startDate || !endDate) return fail('employeeId, startDate, endDate required');
        const assignments = await getEmployeeSchedule(tenantId, employeeId, startDate, endDate);
        const templates = await listTemplates(tenantId);
        const ot = calculateOvertime(assignments, templates);
        const burnout = detectScheduleBurnout(assignments, templates);
        return ok({ assignments, overtime: ot, burnout });
      }

      // ── Overtime Report ──
      case 'overtime-report': {
        const month = parseInt(url.searchParams.get('month') || '') || (new Date().getMonth() + 1);
        const year = parseInt(url.searchParams.get('year') || '') || new Date().getFullYear();
        const dept = url.searchParams.get('department') || '';

        const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0);
        const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

        const db = await getCVisionDb(tenantId);
        const query: any = { tenantId, date: { $gte: firstDay, $lte: lastDayStr }, status: { $ne: 'CANCELLED' } };
        if (dept) query.department = dept;
        const all = await db.collection('cvision_shift_assignments').find(query).limit(5000).toArray() as unknown as ShiftAssignment[];
        const templates = await listTemplates(tenantId);
        const report = generateOvertimeReport(all, templates);
        return ok({ month, year, ...report });
      }

      // ── Conflicts/Alerts ──
      case 'conflicts': {
        const dept = url.searchParams.get('department') || '';
        const weekStart2 = url.searchParams.get('weekStart');
        if (!weekStart2) return fail('weekStart required');
        const week = await getWeekSchedule(tenantId, dept, weekStart2);
        const templates = await listTemplates(tenantId);
        const db = await getCVisionDb(tenantId);
        const ws = await getWorkSchedule(db, tenantId);
        const alerts = generateAlerts(week.assignments, templates, undefined, ws.restDays);
        return ok({ conflicts: week.stats.conflicts, alerts });
      }

      // ── Employee Preferences ──
      case 'preferences': {
        const empId = url.searchParams.get('employeeId');
        if (!empId) return fail('employeeId required');
        const pref = await getPreference(tenantId, empId);
        return ok({ preference: pref });
      }

      // ── Burnout Check ──
      case 'burnout-check': {
        const empIdBurn = url.searchParams.get('employeeId');
        const deptBurn = url.searchParams.get('department');
        const templates = await listTemplates(tenantId);
        const db = await getCVisionDb(tenantId);

        if (empIdBurn) {
          const now = new Date();
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 28);
          const assigns = await db.collection('cvision_shift_assignments').find({
            tenantId, employeeId: empIdBurn,
            date: { $gte: weekAgo.toISOString().split('T')[0], $lte: now.toISOString().split('T')[0] },
            status: { $ne: 'CANCELLED' },
          }).limit(5000).toArray() as unknown as ShiftAssignment[];
          return ok({ burnout: detectScheduleBurnout(assigns, templates) });
        }

        if (deptBurn) {
          const now = new Date();
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          const assigns = await db.collection('cvision_shift_assignments').find({
            tenantId, department: deptBurn,
            date: { $gte: weekAgo.toISOString().split('T')[0], $lte: now.toISOString().split('T')[0] },
            status: { $ne: 'CANCELLED' },
          }).limit(5000).toArray() as unknown as ShiftAssignment[];

          const byEmp = new Map<string, ShiftAssignment[]>();
          for (const a of assigns) {
            const list = byEmp.get(a.employeeId) || [];
            list.push(a);
            byEmp.set(a.employeeId, list);
          }
          const results = [...byEmp.entries()].map(([id, ea]) => ({
            employeeId: id,
            employeeName: ea[0]?.employeeName || id,
            ...detectScheduleBurnout(ea, templates),
          }));

          return ok({ burnoutChecks: results.filter(r => r.atRisk || r.score >= 25).sort((a, b) => b.score - a.score) });
        }

        return fail('employeeId or department required');
      }

      // ── Labor rules (read-only) ──
      case 'labor-rules': {
        const ramadan = isRamadanPeriod(new Date());
        const db = await getCVisionDb(tenantId);
        const ws = await getWorkSchedule(db, tenantId);
        return ok({
          rules: SAUDI_LABOR_RULES,
          currentlyRamadan: ramadan,
          activeMaxDaily: ramadan ? SAUDI_LABOR_RULES.ramadanMaxDaily : SAUDI_LABOR_RULES.maxDailyHours,
          activeMaxWeekly: ramadan ? SAUDI_LABOR_RULES.ramadanMaxWeekly : SAUDI_LABOR_RULES.maxWeeklyHours,
          workSchedule: ws,
        });
      }

      // ── Work schedule settings ──
      case 'work-settings': {
        const db = await getCVisionDb(tenantId);
        const ws = await getWorkSchedule(db, tenantId);
        const deptOverrides = await getAllDepartmentWorkSchedules(db, tenantId);
        return ok({ workSchedule: ws, departmentOverrides: deptOverrides });
      }

      // ── Department work schedule override ──
      case 'department-work-schedule': {
        const departmentId = url.searchParams.get('departmentId');
        if (!departmentId) return fail('departmentId required');
        const db = await getCVisionDb(tenantId);
        const deptWs = await getDepartmentWorkSchedule(db, tenantId, departmentId);
        const tenantWs = await getWorkSchedule(db, tenantId);
        return ok({ departmentSchedule: deptWs, tenantDefault: tenantWs });
      }

      // ── All department schedule overrides ──
      case 'all-department-schedules': {
        const db = await getCVisionDb(tenantId);
        const overrides = await getAllDepartmentWorkSchedules(db, tenantId);
        // Enrich with department names
        const depts = await db.collection('cvision_departments').find({ tenantId }).limit(500).toArray();
        const deptMap = new Map(depts.map((d: any) => [d.id || d.departmentId, d.name || d.nameEn || 'Unknown']));
        const enriched = overrides.map((o: any) => ({
          ...o,
          departmentName: deptMap.get(o.departmentId) || 'Unknown',
        }));
        return ok({ departmentSchedules: enriched });
      }

      // ── Resolved work schedule (Tenant → Dept → Employee) ──
      case 'resolved-work-schedule': {
        const departmentId = url.searchParams.get('departmentId') || undefined;
        const employeeId = url.searchParams.get('employeeId') || undefined;
        const db = await getCVisionDb(tenantId);
        const resolved = await resolveWorkSchedule(db, tenantId, departmentId, employeeId);
        return ok({ workSchedule: resolved, departmentId, employeeId });
      }

      // ── Department employees with their work schedule overrides ──
      case 'department-employees-work-schedules': {
        const departmentId = url.searchParams.get('departmentId');
        if (!departmentId) return fail('departmentId required');
        const unitId = url.searchParams.get('unitId');
        const db = await getCVisionDb(tenantId);

        // ── RBAC: Verify user can access this department/unit ──
        const access = await resolveAccess(db, tenantId, role, userId);

        // Check department access
        if (access.allowedDepartmentIds !== null && !access.allowedDepartmentIds.includes(departmentId)) {
          return fail('You do not have access to this department', 403);
        }

        // Check unit access (if specific unit requested)
        if (unitId && access.allowedUnitIds !== null && !access.allowedUnitIds.includes(unitId)) {
          return fail('You do not have access to this unit', 403);
        }

        // Build query - filter by unit if provided
        const empQuery: any = {
          tenantId,
          departmentId,
          isArchived: { $ne: true },
          status: { $in: ['ACTIVE', 'PROBATION'] },
          deletedAt: null,
        };

        // Apply unit filter: explicit unitId param OR RBAC-restricted units
        if (unitId) {
          empQuery.unitId = unitId;
        } else if (access.allowedUnitIds !== null) {
          // Non-admin: only show employees in their allowed units
          empQuery.unitId = { $in: access.allowedUnitIds };
        }

        // Fetch active employees
        const employees = await db.collection('cvision_employees').find(empQuery, {
          projection: {
            id: 1, employeeNo: 1, firstName: 1, lastName: 1,
            firstNameAr: 1, lastNameAr: 1, unitId: 1,
            workSchedule: 1, nursingRole: 1, fullName: 1,
          }
        }).sort({ firstName: 1, lastName: 1 }).limit(5000).toArray();

        // Get department override and tenant default
        const deptWs = await getDepartmentWorkSchedule(db, tenantId, departmentId);
        const tenantWs = await getWorkSchedule(db, tenantId);

        const employeeList = employees.map((emp: any) => ({
          id: emp.id || emp._id?.toString(),
          employeeNo: emp.employeeNo,
          firstName: emp.firstName,
          lastName: emp.lastName,
          fullName: emp.fullName || `${emp.firstName} ${emp.lastName}`,
          firstNameAr: emp.firstNameAr || null,
          lastNameAr: emp.lastNameAr || null,
          unitId: emp.unitId || null,
          nursingRole: emp.nursingRole || null,
          hasCustomSchedule: !!emp.workSchedule && Object.keys(emp.workSchedule).length > 0,
          workSchedule: emp.workSchedule || null,
        }));

        // Also fetch units for this department (filtered by RBAC)
        const unitsQuery: any = {
          tenantId,
          departmentId,
          isArchived: { $ne: true },
          isActive: { $ne: false },
        };
        // Non-admin: only show units they have access to
        if (access.allowedUnitIds !== null) {
          unitsQuery.id = { $in: access.allowedUnitIds };
        }
        const units = await db.collection('cvision_units').find(unitsQuery, {
          projection: { id: 1, name: 1, nameAr: 1, code: 1, departmentId: 1 }
        }).sort({ sortOrder: 1, name: 1 }).limit(500).toArray();

        const unitList = units.map((u: any) => ({
          id: u.id || u._id?.toString(),
          name: u.name,
          nameAr: u.nameAr || null,
          code: u.code,
          departmentId: u.departmentId,
        }));

        return ok({
          employees: employeeList,
          units: unitList,
          departmentSchedule: deptWs,
          tenantDefault: tenantWs,
        });
      }

      default:
        return fail(`Unknown action: ${action}`);
    }
  } catch (err: any) {
    logger.error('[Scheduling API GET]', err);
    return fail(err.message || 'Internal error', 500);
  }
},
  { platformKey: 'cvision', permissionKey: 'cvision.scheduling.read' });

// ─── POST ───────────────────────────────────────────────────────────────────

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId, role }) => {
  try {
    const body = await request.json();
    const action = body.action;

    switch (action) {
      // ── Create template ──
      case 'create-template': {
        const tpl = await createTemplate(tenantId, body);
        return ok({ template: tpl });
      }

      // ── Assign single shift ──
      case 'assign-shift': {
        const { employeeId, employeeName, department, date, shiftTemplateId, notes, isSplitShift, splitGroupId } = body;
        if (!employeeId || !date || !shiftTemplateId) return fail('employeeId, date, shiftTemplateId required');

        const db = await getCVisionDb(tenantId);

        // ── RBAC: department scope check ──
        // Managers can only assign shifts to employees within their own department(s).
        // HR admins and super-admins are exempt from this restriction.
        if (!isAdminOrHR(role)) {
          const access = await resolveAccess(db, tenantId, role, userId);
          // Resolve the target employee's department
          const targetEmp = await db.collection('cvision_employees').findOne({
            tenantId,
            $or: [{ id: employeeId }, { employeeId }],
          });
          if (!targetEmp) return fail('Employee not found', 404);

          const targetDeptId = targetEmp.departmentId || null;
          const targetUnitId = targetEmp.unitId || null;

          // Check department scope
          if (
            access.allowedDepartmentIds !== null &&
            targetDeptId &&
            !access.allowedDepartmentIds.includes(targetDeptId)
          ) {
            return fail('You can only assign shifts to employees within your own department', 403);
          }

          // Check unit scope (for head nurses and nursing managers scoped to specific units)
          if (
            access.allowedUnitIds !== null &&
            targetUnitId &&
            !access.allowedUnitIds.includes(targetUnitId)
          ) {
            return fail('You can only assign shifts to employees within your unit', 403);
          }
        }

        const templates = await listTemplates(tenantId);
        const tpl = templates.find(t => t.templateId === shiftTemplateId || t.id === shiftTemplateId);
        if (!tpl) return fail('Shift template not found');

        // Load existing assignments for that employee in the week
        const weekStart = getWeekStartFromDate(date);
        const weekEnd = addDaysStr(weekStart, 6);
        const existing = await db.collection('cvision_shift_assignments').find({
          tenantId, employeeId, date: { $gte: weekStart, $lte: weekEnd }, status: { $ne: 'CANCELLED' },
        }).limit(5000).toArray() as unknown as ShiftAssignment[];

        const ws = await getWorkSchedule(db, tenantId);
        const check = checkShiftAssignment(existing, date, tpl.startTime, tpl.endTime, templates, ws.restDays, { isSplitShift, splitGroupId });
        if (!check.allowed) {
          return ok({ assigned: false, violations: check.violations });
        }

        const assignment: ShiftAssignment = {
          id: uuidv4(),
          tenantId,
          employeeId,
          employeeName: employeeName || 'Unknown',
          department: department || '',
          date,
          shiftTemplateId: tpl.templateId || tpl.id,
          shiftName: tpl.name,
          startTime: tpl.startTime,
          endTime: tpl.endTime,
          status: 'SCHEDULED',
          isOvertime: false,
          notes,
          assignedBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await db.collection('cvision_shift_assignments').insertOne(assignment as unknown as Record<string, unknown>);
        return ok({ assigned: true, assignment });
      }

      // ── Auto-generate ──
      case 'auto-generate': {
        const { department, weekStart, shiftRequirements } = body;
        if (!department || !weekStart || !shiftRequirements) return fail('department, weekStart, shiftRequirements required');
        const result = await autoGenerateSchedule({ tenantId, department, weekStart, shiftRequirements, userId });
        return ok(result);
      }

      // ── Save preference ──
      case 'save-preference': {
        const { employeeId, ...prefData } = body;
        if (!employeeId) return fail('employeeId required');
        const pref = await savePreference(tenantId, employeeId, prefData);
        return ok({ preference: pref });
      }

      // ── Swap shifts ──
      case 'swap': {
        const { assignmentId1, assignmentId2 } = body;
        if (!assignmentId1 || !assignmentId2) return fail('assignmentId1, assignmentId2 required');
        const templates = await listTemplates(tenantId);
        const result = await swapShifts(tenantId, assignmentId1, assignmentId2, templates);
        return ok(result);
      }

      // ── Bulk assign ──
      case 'bulk-assign': {
        const { assignments: bulkData } = body;
        if (!Array.isArray(bulkData) || bulkData.length === 0) return fail('assignments array required');

        const templates = await listTemplates(tenantId);
        const db = await getCVisionDb(tenantId);
        const ws = await getWorkSchedule(db, tenantId);
        const now = new Date();

        // ── RBAC: pre-check department/unit scope for all employees ──
        let access: { allowedUnitIds: string[] | null; allowedDepartmentIds: string[] | null } | null = null;
        if (!isAdminOrHR(role)) {
          access = await resolveAccess(db, tenantId, role, userId);
        }

        // ── Phase 1: Validate ALL items (labor law + RBAC) before inserting any ──
        const validationResults: { index: number; employeeId: string; date: string; violations: string[] }[] = [];

        for (let i = 0; i < bulkData.length; i++) {
          const item = bulkData[i];
          const itemViolations: string[] = [];

          const tpl = templates.find(t => t.templateId === item.shiftTemplateId || t.id === item.shiftTemplateId);
          if (!tpl) {
            itemViolations.push('Template not found');
            validationResults.push({ index: i, employeeId: item.employeeId, date: item.date, violations: itemViolations });
            continue;
          }

          // RBAC scope check (same as assign-shift)
          if (access) {
            const targetEmp = await db.collection('cvision_employees').findOne({
              tenantId,
              $or: [{ id: item.employeeId }, { employeeId: item.employeeId }],
            });
            if (!targetEmp) {
              itemViolations.push('Employee not found');
            } else {
              if (access.allowedDepartmentIds !== null && targetEmp.departmentId && !access.allowedDepartmentIds.includes(targetEmp.departmentId)) {
                itemViolations.push('You can only assign shifts to employees within your own department');
              }
              if (access.allowedUnitIds !== null && targetEmp.unitId && !access.allowedUnitIds.includes(targetEmp.unitId)) {
                itemViolations.push('You can only assign shifts to employees within your unit');
              }
            }
          }

          // Labor law validation (same as assign-shift)
          if (itemViolations.length === 0) {
            const weekStart = getWeekStartFromDate(item.date);
            const weekEnd = addDaysStr(weekStart, 6);
            const existing = await db.collection('cvision_shift_assignments').find({
              tenantId, employeeId: item.employeeId, date: { $gte: weekStart, $lte: weekEnd }, status: { $ne: 'CANCELLED' },
            }).limit(5000).toArray() as unknown as ShiftAssignment[];

            const check = checkShiftAssignment(existing, item.date, tpl.startTime, tpl.endTime, templates, ws.restDays);
            if (!check.allowed) {
              itemViolations.push(...(check.violations || ['Labor law violation']));
            }
          }

          if (itemViolations.length > 0) {
            validationResults.push({ index: i, employeeId: item.employeeId, date: item.date, violations: itemViolations });
          }
        }

        // If any validation failed, reject the entire batch
        if (validationResults.length > 0) {
          return fail(JSON.stringify({
            message: `Bulk assignment rejected: ${validationResults.length} of ${bulkData.length} assignments failed validation`,
            failures: validationResults,
          }), 400);
        }

        // ── Phase 2: All passed — insert all assignments ──
        const results: { success: boolean; employeeId: string; date: string }[] = [];

        for (const item of bulkData) {
          const tpl = templates.find(t => t.templateId === item.shiftTemplateId || t.id === item.shiftTemplateId)!;

          const assignment: ShiftAssignment = {
            id: uuidv4(),
            tenantId,
            employeeId: item.employeeId,
            employeeName: item.employeeName || 'Unknown',
            department: item.department || '',
            date: item.date,
            shiftTemplateId: tpl.templateId || tpl.id,
            shiftName: tpl.name,
            startTime: tpl.startTime,
            endTime: tpl.endTime,
            status: 'SCHEDULED',
            isOvertime: false,
            notes: item.notes,
            assignedBy: userId,
            createdAt: now,
            updatedAt: now,
          };
          await db.collection('cvision_shift_assignments').insertOne(assignment as unknown as Record<string, unknown>);
          results.push({ success: true, employeeId: item.employeeId, date: item.date });
        }

        return ok({ results, total: results.length, successful: results.length });
      }

      // ── Cancel assignment ──
      case 'cancel-assignment': {
        const { assignmentId } = body;
        if (!assignmentId) return fail('assignmentId required');
        const cancelled = await cancelAssignment(tenantId, assignmentId);
        return ok({ cancelled });
      }

      // ── Seed templates ──
      case 'seed-templates': {
        const count = await seedDefaultTemplates(tenantId);
        return ok({ seeded: count });
      }

      // ── Update work schedule settings (tenant-level) — Admin/HR only ──
      case 'update-work-settings': {
        if (!isAdminOrHR(role)) {
          return fail('Only admins can modify organization-level work settings', 403);
        }
        const { workDays, restDays, defaultStartTime, defaultEndTime, defaultWorkingHours, breakDurationMinutes, graceMinutes, splitShiftEnabled, splitShiftSegments } = body;
        const db = await getCVisionDb(tenantId);
        const updates: any = {};
        if (workDays != null) updates.workDays = workDays;
        if (restDays != null) updates.restDays = restDays;
        if (defaultStartTime != null) updates.defaultStartTime = defaultStartTime;
        if (defaultEndTime != null) updates.defaultEndTime = defaultEndTime;
        if (defaultWorkingHours != null) updates.defaultWorkingHours = defaultWorkingHours;
        if (breakDurationMinutes != null) updates.breakDurationMinutes = breakDurationMinutes;
        if (graceMinutes != null) updates.graceMinutes = graceMinutes;
        if (splitShiftEnabled != null) updates.splitShiftEnabled = splitShiftEnabled;
        if (splitShiftSegments != null) updates.splitShiftSegments = splitShiftSegments;
        await updateWorkSchedule(db, tenantId, updates);
        const ws = await getWorkSchedule(db, tenantId);
        return ok({ workSchedule: ws });
      }

      // ── Update department work schedule override ──
      case 'update-department-work-settings': {
        const { departmentId, ...settings } = body;
        if (!departmentId) return fail('departmentId required');
        delete settings.action;
        const db = await getCVisionDb(tenantId);

        // RBAC: verify user can modify this department's settings
        const deptAccess = await resolveAccess(db, tenantId, role, userId);
        if (deptAccess.allowedDepartmentIds !== null && !deptAccess.allowedDepartmentIds.includes(departmentId)) {
          return fail('You do not have access to modify this department\'s settings', 403);
        }

        await updateDepartmentWorkSchedule(db, tenantId, departmentId, settings);
        const deptWs = await getDepartmentWorkSchedule(db, tenantId, departmentId);
        return ok({ departmentSchedule: deptWs });
      }

      // ── Delete department work schedule override ──
      case 'delete-department-work-settings': {
        const { departmentId } = body;
        if (!departmentId) return fail('departmentId required');
        const db = await getCVisionDb(tenantId);

        // RBAC: verify user can modify this department's settings
        const delAccess = await resolveAccess(db, tenantId, role, userId);
        if (delAccess.allowedDepartmentIds !== null && !delAccess.allowedDepartmentIds.includes(departmentId)) {
          return fail('You do not have access to this department', 403);
        }

        await deleteDepartmentWorkSchedule(db, tenantId, departmentId);
        return ok({ deleted: true, departmentId });
      }

      // ── Update employee work schedule override ──
      case 'update-employee-work-settings': {
        const { employeeId, ...wsData } = body;
        if (!employeeId) return fail('employeeId required');
        delete wsData.action;
        const db = await getCVisionDb(tenantId);

        // RBAC: verify user can modify this employee's schedule
        const access = await resolveAccess(db, tenantId, role, userId);
        if (access.allowedUnitIds !== null) {
          const emp = await db.collection('cvision_employees').findOne({ tenantId, $or: [{ id: employeeId }, { employeeId }] });
          if (emp?.unitId && !access.allowedUnitIds.includes(emp.unitId)) {
            return fail('You do not have access to modify this employee\'s schedule', 403);
          }
          if (emp?.departmentId && access.allowedDepartmentIds !== null && !access.allowedDepartmentIds.includes(emp.departmentId)) {
            return fail('You do not have access to this department', 403);
          }
        }

        await db.collection('cvision_employees').updateOne(
          { tenantId, $or: [{ id: employeeId }, { employeeId }] },
          { $set: { workSchedule: wsData, updatedAt: new Date() } },
        );
        return ok({ updated: true, employeeId });
      }

      // ── Delete employee work schedule override (reset to default) ──
      case 'delete-employee-work-settings': {
        const { employeeId } = body;
        if (!employeeId) return fail('employeeId required');
        const db = await getCVisionDb(tenantId);

        // RBAC: verify user can modify this employee's schedule
        const access2 = await resolveAccess(db, tenantId, role, userId);
        if (access2.allowedUnitIds !== null) {
          const emp = await db.collection('cvision_employees').findOne({ tenantId, $or: [{ id: employeeId }, { employeeId }] });
          if (emp?.unitId && !access2.allowedUnitIds.includes(emp.unitId)) {
            return fail('You do not have access to modify this employee\'s schedule', 403);
          }
        }

        await db.collection('cvision_employees').updateOne(
          { tenantId, $or: [{ id: employeeId }, { employeeId }] },
          { $unset: { workSchedule: '' }, $set: { updatedAt: new Date() } },
        );
        return ok({ deleted: true, employeeId });
      }

      // ── Bulk update employee work schedules ──
      case 'bulk-update-employee-work-settings': {
        const { employeeIds, ...wsData } = body;
        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
          return fail('employeeIds array required');
        }
        delete wsData.action;
        const db = await getCVisionDb(tenantId);

        // RBAC: verify user can modify these employees
        const access3 = await resolveAccess(db, tenantId, role, userId);
        if (access3.allowedUnitIds !== null) {
          const emps = await db.collection('cvision_employees').find(
            { tenantId, id: { $in: employeeIds }, deletedAt: null },
            { projection: { id: 1, unitId: 1, departmentId: 1 } }
          ).toArray();
          const unauthorized = emps.filter((e: any) => e.unitId && !access3.allowedUnitIds!.includes(e.unitId));
          if (unauthorized.length > 0) {
            return fail(`You do not have access to modify ${unauthorized.length} of the selected employees`, 403);
          }
        }

        await db.collection('cvision_employees').updateMany(
          { tenantId, id: { $in: employeeIds } },
          { $set: { workSchedule: wsData, updatedAt: new Date() } },
        );
        return ok({ updated: true, count: employeeIds.length });
      }

      // ── Assign split shift (multiple segments for same employee/day) ──
      case 'assign-split-shift': {
        const { employeeId, employeeName, department, date, segments } = body;
        if (!employeeId || !date || !segments || !Array.isArray(segments) || segments.length < 2) {
          return fail('employeeId, date, and at least 2 segments required');
        }

        const templates = await listTemplates(tenantId);
        const db = await getCVisionDb(tenantId);
        const splitGroupId = uuidv4();
        const now = new Date();
        const created: ShiftAssignment[] = [];

        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const tpl = templates.find(t => t.templateId === seg.shiftTemplateId || t.id === seg.shiftTemplateId);

          const assignment: ShiftAssignment = {
            id: uuidv4(),
            tenantId,
            employeeId,
            employeeName: employeeName || 'Unknown',
            department: department || '',
            date,
            shiftTemplateId: seg.shiftTemplateId || `SPLIT-${i}`,
            shiftName: seg.label || tpl?.name || `Segment ${i + 1}`,
            startTime: seg.startTime,
            endTime: seg.endTime,
            status: 'SCHEDULED',
            isOvertime: false,
            notes: seg.notes,
            assignedBy: userId,
            splitGroupId,
            splitSegmentIndex: i,
            isSplitShift: true,
            createdAt: now,
            updatedAt: now,
          };
          await db.collection('cvision_shift_assignments').insertOne(assignment as unknown as Record<string, unknown>);
          created.push(assignment);
        }

        return ok({ assigned: true, splitGroupId, segments: created });
      }

      default:
        return fail(`Unknown action: ${action}`);
    }
  } catch (err: any) {
    logger.error('[Scheduling API POST]', err);
    return fail(err.message || 'Internal error', 500);
  }
});

// ─── Utility ────────────────────────────────────────────────────────────────

function getWeekStartFromDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dow = d.getUTCDay();
  // Sunday = 0 is typical week start for Saudi
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().split('T')[0];
}

function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}
