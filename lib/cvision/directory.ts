/**
 * CVision Employee Directory Engine
 *
 * No new collection — reads from cvision_employees.
 *
 * Handles:
 *  - Full-text search across employee fields
 *  - Department-grouped listing
 *  - Org-tree (manager hierarchy)
 *  - Who-is-out (on leave / absent today)
 *  - Birthdays & work anniversaries
 *  - New joiners (last 30 days)
 *  - Floor / location map
 */

import type { Db } from '@/lib/cvision/infra/mongo-compat';

// ── Search ──────────────────────────────────────────────────────────────

export async function searchEmployees(
  db: Db, tenantId: string, query: string, filters: { departmentId?: string; status?: string; limit?: number } = {},
): Promise<any[]> {
  const match: any = { tenantId };
  if (filters.departmentId) match.departmentId = filters.departmentId;
  if (filters.status) match.status = filters.status;
  else match.status = { $ne: 'TERMINATED' };

  if (query) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    match.$or = [
      { firstName: { $regex: escaped, $options: 'i' } },
      { lastName: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
      { employeeNo: { $regex: escaped, $options: 'i' } },
      { jobTitle: { $regex: escaped, $options: 'i' } },
      { phone: { $regex: escaped, $options: 'i' } },
    ];
  }

  match.deletedAt = null;

  return db.collection('cvision_employees')
    .find(match, { projection: { salary: 0, bankAccount: 0, iqama: 0, passport: 0 } })
    .sort({ firstName: 1, lastName: 1 })
    .limit(filters.limit || 200)
    .toArray();
}

// ── Department Grouped ──────────────────────────────────────────────────

export async function getByDepartment(db: Db, tenantId: string): Promise<any[]> {
  const employees = await db.collection('cvision_employees')
    .find({ tenantId, status: { $ne: 'TERMINATED' }, deletedAt: null }, { projection: { salary: 0, bankAccount: 0, iqama: 0, passport: 0 } })
    .sort({ departmentName: 1, firstName: 1 })
    .toArray();

  const groups: Record<string, any[]> = {};
  for (const e of employees) {
    const dept = e.departmentName || 'Unassigned';
    if (!groups[dept]) groups[dept] = [];
    groups[dept].push(e);
  }

  return Object.entries(groups).map(([department, members]) => ({ department, count: members.length, members }));
}

// ── Org Tree ────────────────────────────────────────────────────────────

export async function getOrgTree(db: Db, tenantId: string): Promise<any[]> {
  const employees = await db.collection('cvision_employees')
    .find({ tenantId, status: { $ne: 'TERMINATED' }, deletedAt: null }, {
      projection: { id: 1, firstName: 1, lastName: 1, jobTitle: 1, departmentName: 1, managerId: 1, photo: 1 },
    })
    .toArray();

  const map = new Map<string, any>();
  for (const e of employees) {
    map.set(e.id, { ...e, children: [] });
  }

  const roots: any[] = [];
  for (const e of map.values()) {
    if (e.managerId && map.has(e.managerId)) {
      map.get(e.managerId).children.push(e);
    } else {
      roots.push(e);
    }
  }

  return roots;
}

// ── Who's Out ───────────────────────────────────────────────────────────

export async function getWhosOut(db: Db, tenantId: string): Promise<any> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Check leaves
  const onLeave = await db.collection('cvision_leaves')
    .find({ tenantId, status: 'APPROVED', startDate: { $lte: tomorrow }, endDate: { $gte: today } })
    .toArray();

  // Check attendance (absent if no check-in today)
  const todayAttendance = await db.collection('cvision_attendance')
    .find({ tenantId, date: { $gte: today, $lt: tomorrow } })
    .toArray();

  const checkedInIds = new Set(todayAttendance.map((a: any) => a.employeeId));

  const totalActive = await db.collection('cvision_employees').countDocuments({
    tenantId, status: 'ACTIVE', deletedAt: null,
  });

  return {
    onLeave: onLeave.map((l: any) => ({
      employeeId: l.employeeId, employeeName: l.employeeName,
      leaveType: l.leaveType, startDate: l.startDate, endDate: l.endDate,
    })),
    totalOnLeave: onLeave.length,
    totalPresent: checkedInIds.size,
    totalActive,
    absentRate: totalActive > 0 ? Math.round(((totalActive - checkedInIds.size) / totalActive) * 100) : 0,
  };
}

// ── Birthdays ───────────────────────────────────────────────────────────

export async function getBirthdays(db: Db, tenantId: string, month?: number): Promise<any[]> {
  const targetMonth = month || (new Date().getMonth() + 1);
  const employees = await db.collection('cvision_employees')
    .find({ tenantId, status: { $ne: 'TERMINATED' }, deletedAt: null })
    .toArray();

  return employees
    .filter((e: any) => {
      if (!e.dateOfBirth) return false;
      const dob = new Date(e.dateOfBirth);
      return (dob.getMonth() + 1) === targetMonth;
    })
    .map((e: any) => ({
      id: e.id, firstName: e.firstName, lastName: e.lastName,
      departmentName: e.departmentName, jobTitle: e.jobTitle,
      dateOfBirth: e.dateOfBirth, day: new Date(e.dateOfBirth).getDate(),
    }))
    .sort((a: any, b: any) => a.day - b.day);
}

// ── Anniversaries ───────────────────────────────────────────────────────

export async function getAnniversaries(db: Db, tenantId: string, month?: number): Promise<any[]> {
  const targetMonth = month || (new Date().getMonth() + 1);
  const now = new Date();
  const employees = await db.collection('cvision_employees')
    .find({ tenantId, status: { $ne: 'TERMINATED' }, deletedAt: null })
    .toArray();

  return employees
    .filter((e: any) => {
      if (!e.hireDate) return false;
      const hire = new Date(e.hireDate);
      return (hire.getMonth() + 1) === targetMonth;
    })
    .map((e: any) => {
      const hire = new Date(e.hireDate);
      const years = now.getFullYear() - hire.getFullYear();
      return {
        id: e.id, firstName: e.firstName, lastName: e.lastName,
        departmentName: e.departmentName, jobTitle: e.jobTitle,
        hireDate: e.hireDate, years, day: hire.getDate(),
      };
    })
    .sort((a: any, b: any) => a.day - b.day);
}

// ── New Joiners ─────────────────────────────────────────────────────────

export async function getNewJoiners(db: Db, tenantId: string, days: number = 30): Promise<any[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return db.collection('cvision_employees')
    .find(
      { tenantId, hireDate: { $gte: since }, status: { $ne: 'TERMINATED' }, deletedAt: null },
      { projection: { salary: 0, bankAccount: 0, iqama: 0, passport: 0 } },
    )
    .sort({ hireDate: -1 })
    .toArray();
}

// ── Floor Map ───────────────────────────────────────────────────────────

export async function getFloorMap(db: Db, tenantId: string): Promise<any[]> {
  const employees = await db.collection('cvision_employees')
    .find({ tenantId, status: { $ne: 'TERMINATED' }, deletedAt: null })
    .toArray();

  const locations: Record<string, any[]> = {};
  for (const e of employees) {
    const loc = e.workLocation || e.branchName || 'Main Office';
    if (!locations[loc]) locations[loc] = [];
    locations[loc].push({
      id: e.id, firstName: e.firstName, lastName: e.lastName,
      jobTitle: e.jobTitle, departmentName: e.departmentName,
      floor: e.floor, desk: e.desk,
    });
  }

  return Object.entries(locations).map(([location, employees]) => ({
    location, count: employees.length, employees,
  }));
}

// ── Stats ───────────────────────────────────────────────────────────────

export async function getStats(db: Db, tenantId: string) {
  const total = await db.collection('cvision_employees').countDocuments({ tenantId, deletedAt: null });
  const active = await db.collection('cvision_employees').countDocuments({ tenantId, status: 'ACTIVE', deletedAt: null });
  const departments = await db.collection('cvision_departments').countDocuments({ tenantId });

  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const employees = await db.collection('cvision_employees').find({ tenantId, status: { $ne: 'TERMINATED' }, deletedAt: null }).toArray();

  const birthdays = employees.filter((e: any) => e.dateOfBirth && (new Date(e.dateOfBirth).getMonth() + 1) === thisMonth).length;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newJoiners = employees.filter((e: any) => e.hireDate && new Date(e.hireDate) >= thirtyDaysAgo).length;

  return { totalEmployees: total, activeEmployees: active, departments, birthdaysThisMonth: birthdays, newJoinersLast30: newJoiners };
}
