import { Db } from '@/lib/cvision/infra/mongo-compat';
import { prisma } from '@/lib/db/prisma';
import {
  COLLECTION_TO_PRISMA,
  mongoFilterToPrisma,
} from '@/lib/cvision/prisma-helpers';

export interface ETLResult { table: string; rowCount: number; duration: number; }

export async function runETL(db: Db, tenantId: string): Promise<ETLResult[]> {
  const results: ETLResult[] = [];
  const run = async (table: string, fn: () => Promise<number>) => {
    const start = Date.now();
    const count = await fn();
    results.push({ table, rowCount: count, duration: Date.now() - start });
  };

  /**
   * Atomically replace all rows for a DW table belonging to the given tenant.
   *
   * The delete and insert run inside a single Prisma interactive transaction so
   * they either both commit or both roll back. Without this, a failed insertMany
   * would leave the table empty after the preceding deleteMany had already run.
   */
  const replaceRows = async (
    dwCollectionName: string,
    rows: Record<string, any>[]
  ): Promise<void> => {
    if (!rows.length) return;

    const modelKey = COLLECTION_TO_PRISMA[dwCollectionName];
    if (!modelKey) {
      throw new Error(`ETL: unknown DW collection "${dwCollectionName}" — add it to COLLECTION_TO_PRISMA`);
    }

    const where = mongoFilterToPrisma({ tenantId });

    await prisma.$transaction(async (tx) => {
      const delegate = (tx as any)[modelKey];
      await delegate.deleteMany({ where });
      await delegate.createMany({ data: rows, skipDuplicates: true });
    });
  };

  await run('fact_employees', async () => {
    const emps = await db.collection('cvision_employees').find({ tenantId, deletedAt: null }).limit(10000).toArray();
    const rows = emps.map((e: any) => ({
      tenantId, employeeId: e.employeeId || e.id, name: e.fullName || [e.firstName, e.lastName].filter(Boolean).join(' ') || e.nameEn, department: e.departmentName,
      grade: e.gradeId, nationality: e.nationality, gender: e.gender, status: e.status,
      joinDate: e.hiredAt || e.joinDate, salary: e.basicSalary || 0, age: e.dateOfBirth ? Math.floor((Date.now() - new Date(e.dateOfBirth).getTime()) / 31557600000) : null,
      tenureMonths: (e.hiredAt || e.joinDate) ? Math.floor((Date.now() - new Date(e.hiredAt || e.joinDate).getTime()) / 2629800000) : null,
      _etlDate: new Date(),
    }));
    await replaceRows('cvision_dw_fact_employees', rows);
    return rows.length;
  });

  await run('fact_leaves', async () => {
    const leaves = await db.collection('cvision_leaves').find({ tenantId }).toArray();
    const rows = leaves.map((l: any) => ({
      tenantId, leaveId: l.leaveId, employeeId: l.employeeId, department: l.departmentName,
      type: l.leaveType, startDate: l.startDate, endDate: l.endDate, days: l.days || 0,
      status: l.status, approvalTimeHours: l.approvedAt && l.createdAt ? (new Date(l.approvedAt).getTime() - new Date(l.createdAt).getTime()) / 3600000 : null,
      _etlDate: new Date(),
    }));
    await replaceRows('cvision_dw_fact_leaves', rows);
    return rows.length;
  });

  await run('fact_payroll', async () => {
    const payroll = await db.collection('cvision_payroll').find({ tenantId }).toArray();
    const rows = payroll.map((p: any) => ({
      tenantId, month: p.period || p.month, employeeId: p.employeeId, department: p.departmentName,
      basicSalary: p.basicSalary || 0, allowances: p.totalAllowances || 0, deductions: p.totalDeductions || 0,
      netPay: p.netPay || 0, _etlDate: new Date(),
    }));
    await replaceRows('cvision_dw_fact_payroll', rows);
    return rows.length;
  });

  await run('fact_training', async () => {
    const courses = await db.collection('cvision_training_courses').find({ tenantId }).toArray();
    const rows = courses.map((c: any) => ({
      tenantId, courseId: c.courseId, title: c.title, hours: c.durationHours || 0,
      cost: c.budget || 0, enrolledCount: c.enrolledCount || 0, completedCount: c.completedCount || 0,
      status: c.status, _etlDate: new Date(),
    }));
    await replaceRows('cvision_dw_fact_training', rows);
    return rows.length;
  });

  await run('dim_departments', async () => {
    const pipeline = [
      { $match: { tenantId, status: { $in: ['ACTIVE', 'active'] }, deletedAt: null } },
      { $group: { _id: '$departmentName', headcount: { $sum: 1 } } },
    ];
    const depts = await db.collection('cvision_employees').aggregate(pipeline).toArray();
    const rows = depts.map((d: any) => ({ tenantId, name: d._id, headcount: d.headcount, _etlDate: new Date() }));
    await replaceRows('cvision_dw_dim_departments', rows);
    return rows.length;
  });

  return results;
}

export const DW_TABLES = [
  { name: 'cvision_dw_fact_employees', label: 'Employees', description: 'Employee master data' },
  { name: 'cvision_dw_fact_leaves', label: 'Leaves', description: 'Leave transactions' },
  { name: 'cvision_dw_fact_payroll', label: 'Payroll', description: 'Payroll records' },
  { name: 'cvision_dw_fact_training', label: 'Training', description: 'Training courses' },
  { name: 'cvision_dw_dim_departments', label: 'Departments', description: 'Department dimension' },
];
