import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export type ReportCategory = 'HR' | 'PAYROLL' | 'RECRUITMENT' | 'ATTENDANCE' | 'TRAINING' | 'INSURANCE' | 'CUSTOM';
export type ChartType = 'TABLE' | 'BAR' | 'LINE' | 'PIE' | 'DONUT' | 'AREA' | 'SCATTER';
export type FilterOperator = 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'GREATER' | 'LESS' | 'BETWEEN' | 'IN';
export type ColumnType = 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'CURRENCY';
export type ScheduleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  HR: 'Human Resources', PAYROLL: 'Payroll', RECRUITMENT: 'Recruitment',
  ATTENDANCE: 'Attendance', TRAINING: 'Training', INSURANCE: 'Insurance', CUSTOM: 'Custom',
};

export const CHART_OPTIONS: { value: ChartType; label: string }[] = [
  { value: 'TABLE', label: 'Table' }, { value: 'BAR', label: 'Bar Chart' },
  { value: 'LINE', label: 'Line Chart' }, { value: 'PIE', label: 'Pie Chart' },
  { value: 'DONUT', label: 'Donut Chart' }, { value: 'AREA', label: 'Area Chart' },
  { value: 'SCATTER', label: 'Scatter Plot' },
];

/* ── Pre-built Templates ───────────────────────────────────────────── */

export const REPORT_TEMPLATES = [
  { name: 'Employee Directory', source: 'cvision_employees', category: 'HR' as ReportCategory, description: 'Full list of all employees with key details' },
  { name: 'Headcount by Department', source: 'cvision_employees', category: 'HR' as ReportCategory, description: 'Employee count grouped by department', groupBy: ['department'] },
  { name: 'New Hires This Month', source: 'cvision_employees', category: 'HR' as ReportCategory, description: 'Employees who joined in the current month' },
  { name: 'Contract Expiry Report', source: 'cvision_employees', category: 'HR' as ReportCategory, description: 'Contracts expiring within next 90 days' },
  { name: 'Probation Report', source: 'cvision_employees', category: 'HR' as ReportCategory, description: 'Employees currently on probation' },
  { name: 'Nationality Distribution', source: 'cvision_employees', category: 'HR' as ReportCategory, description: 'Employee distribution by nationality', groupBy: ['nationality'] },
  { name: 'Saudization Report', source: 'cvision_employees', category: 'HR' as ReportCategory, description: 'Nitaqat/Saudization compliance breakdown' },

  { name: 'Monthly Payroll Summary', source: 'cvision_payroll', category: 'PAYROLL' as ReportCategory, description: 'Total payroll costs for selected month' },
  { name: 'Department Cost Report', source: 'cvision_payroll', category: 'PAYROLL' as ReportCategory, description: 'Payroll costs by department', groupBy: ['department'] },
  { name: 'Overtime Report', source: 'cvision_payroll', category: 'PAYROLL' as ReportCategory, description: 'Overtime hours and payments' },
  { name: 'GOSI Report', source: 'cvision_payroll', category: 'PAYROLL' as ReportCategory, description: 'GOSI contributions summary' },
  { name: 'Bank Transfer File', source: 'cvision_payroll', category: 'PAYROLL' as ReportCategory, description: 'Bank-ready salary transfer file' },

  { name: 'Daily Attendance', source: 'cvision_attendance', category: 'ATTENDANCE' as ReportCategory, description: 'Today\'s attendance log' },
  { name: 'Absence Report', source: 'cvision_attendance', category: 'ATTENDANCE' as ReportCategory, description: 'Absence frequency by employee' },
  { name: 'Late Arrivals', source: 'cvision_attendance', category: 'ATTENDANCE' as ReportCategory, description: 'Late arrival incidents' },
  { name: 'Overtime Hours', source: 'cvision_attendance', category: 'ATTENDANCE' as ReportCategory, description: 'Total overtime hours by employee' },
  { name: 'Leave Balance Report', source: 'cvision_leaves', category: 'ATTENDANCE' as ReportCategory, description: 'Current leave balances for all employees' },

  { name: 'Open Positions', source: 'cvision_jobs', category: 'RECRUITMENT' as ReportCategory, description: 'All currently open job positions' },
  { name: 'Candidate Pipeline', source: 'cvision_candidates', category: 'RECRUITMENT' as ReportCategory, description: 'Candidates by recruitment stage' },
  { name: 'Time to Hire', source: 'cvision_candidates', category: 'RECRUITMENT' as ReportCategory, description: 'Average time from opening to hire by department' },
  { name: 'Source Effectiveness', source: 'cvision_candidates', category: 'RECRUITMENT' as ReportCategory, description: 'Hire quality and volume by recruitment source' },

  { name: 'Training Completion', source: 'cvision_training_enrollments', category: 'TRAINING' as ReportCategory, description: 'Training course completion rates' },
  { name: 'Training Budget Utilization', source: 'cvision_training_budget', category: 'TRAINING' as ReportCategory, description: 'Budget spent vs. allocated for training' },
  { name: 'Certification Expiry', source: 'cvision_training_enrollments', category: 'TRAINING' as ReportCategory, description: 'Certificates expiring in next 90 days' },

  { name: 'Insurance Coverage', source: 'cvision_employee_insurance', category: 'INSURANCE' as ReportCategory, description: 'Insurance coverage by class and provider' },
  { name: 'Claims Report', source: 'cvision_insurance_claims', category: 'INSURANCE' as ReportCategory, description: 'Insurance claims summary' },
  { name: 'Insurance Cost by Department', source: 'cvision_employee_insurance', category: 'INSURANCE' as ReportCategory, description: 'Insurance premiums by department' },
];

/* ── Seed Data ─────────────────────────────────────────────────────── */

export async function ensureSeedData(db: Db, tenantId: string): Promise<void> {
  const coll = db.collection('cvision_saved_reports');
  const count = await coll.countDocuments({ tenantId });
  if (count > 0) return;

  const now = new Date();
  await coll.insertMany([
    {
      tenantId, reportId: 'RPT-001', name: 'Monthly Headcount Summary', description: 'Current headcount with department breakdown',
      category: 'HR', query: { dataSource: 'cvision_employees', filters: [], columns: [
        { field: 'department', label: 'Department', type: 'STRING' },
        { field: 'count', label: 'Headcount', type: 'NUMBER', aggregation: 'COUNT' },
      ], groupBy: ['department'], sortBy: [{ field: 'count', direction: 'DESC' }] },
      chartType: 'BAR', scheduled: true,
      schedule: { frequency: 'MONTHLY', dayOfMonth: 1, time: '08:00', recipients: ['hr@company.com'], format: 'PDF' },
      visibility: 'COMPANY', createdBy: 'admin', lastRunAt: new Date(Date.now() - 86400000 * 3), createdAt: now, updatedAt: now,
    },
    {
      tenantId, reportId: 'RPT-002', name: 'Saudization Tracker', description: 'Weekly nationality distribution for compliance',
      category: 'HR', query: { dataSource: 'cvision_employees', filters: [], columns: [
        { field: 'nationality', label: 'Nationality', type: 'STRING' },
        { field: 'count', label: 'Count', type: 'NUMBER', aggregation: 'COUNT' },
      ], groupBy: ['nationality'], sortBy: [{ field: 'count', direction: 'DESC' }] },
      chartType: 'PIE', scheduled: true,
      schedule: { frequency: 'WEEKLY', dayOfWeek: 0, time: '09:00', recipients: ['hr@company.com', 'ceo@company.com'], format: 'PDF' },
      visibility: 'COMPANY', createdBy: 'admin', lastRunAt: new Date(Date.now() - 86400000 * 5), createdAt: now, updatedAt: now,
    },
  ]);
}

/* ── Report Execution ──────────────────────────────────────────────── */

export async function runReport(db: Db, tenantId: string, query: any) {
  const { dataSource, filters, columns, groupBy, sortBy, limit } = query;
  const coll = db.collection(dataSource);

  const mongoFilter: any = { tenantId };
  for (const f of filters || []) {
    switch (f.operator) {
      case 'EQUALS':     mongoFilter[f.field] = f.value; break;
      case 'NOT_EQUALS': mongoFilter[f.field] = { $ne: f.value }; break;
      case 'CONTAINS':   mongoFilter[f.field] = { $regex: String(f.value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }; break;
      case 'GREATER':    mongoFilter[f.field] = { $gt: f.value }; break;
      case 'LESS':       mongoFilter[f.field] = { $lt: f.value }; break;
      case 'BETWEEN':    mongoFilter[f.field] = { $gte: f.value[0], $lte: f.value[1] }; break;
      case 'IN':         mongoFilter[f.field] = { $in: f.value }; break;
    }
  }

  if (groupBy && groupBy.length > 0) {
    const groupId: any = {};
    for (const g of groupBy) groupId[g] = `$${g}`;

    const aggStages: any[] = [{ $match: mongoFilter }, { $group: { _id: groupId, count: { $sum: 1 } } }];

    const aggColumns = (columns || []).filter((c: any) => c.aggregation);
    for (const ac of aggColumns) {
      if (ac.aggregation === 'SUM') aggStages[1].$group[ac.field] = { $sum: `$${ac.field}` };
      else if (ac.aggregation === 'AVG') aggStages[1].$group[ac.field] = { $avg: `$${ac.field}` };
      else if (ac.aggregation === 'MIN') aggStages[1].$group[ac.field] = { $min: `$${ac.field}` };
      else if (ac.aggregation === 'MAX') aggStages[1].$group[ac.field] = { $max: `$${ac.field}` };
    }

    if (sortBy?.[0]) aggStages.push({ $sort: { [sortBy[0].field]: sortBy[0].direction === 'DESC' ? -1 : 1 } });
    if (limit) aggStages.push({ $limit: limit });

    return coll.aggregate(aggStages).toArray();
  }

  const projection: any = {};
  for (const c of columns || []) projection[c.field] = 1;

  let cursor = coll.find(mongoFilter, { projection });
  if (sortBy?.[0]) cursor = cursor.sort({ [sortBy[0].field]: sortBy[0].direction === 'DESC' ? -1 : 1 });
  if (limit) cursor = cursor.limit(limit);

  return cursor.toArray();
}
