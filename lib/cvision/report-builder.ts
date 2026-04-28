import { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ──────────────────────────────────────────────────────────────────── */

export interface ReportTemplate {
  key: string;
  name: string;
  nameAr: string;
  description: string;
  collection: string;
  defaultFields: string[];
  defaultGroupBy?: string;
  defaultSort?: string;
  parameters?: { name: string; type: 'date' | 'select' | 'text'; options?: string[] }[];
}

/* ── Templates ──────────────────────────────────────────────────────────────── */

export const REPORT_TEMPLATES: ReportTemplate[] = [
  { key: 'headcount', name: 'Headcount Report', nameAr: 'تقرير أعداد الموظفين', description: 'Employees by department, grade, nationality, status', collection: 'cvision_employees', defaultFields: ['employeeNo', 'name', 'department', 'jobTitle', 'nationality', 'status'], defaultGroupBy: 'department' },
  { key: 'turnover', name: 'Turnover Report', nameAr: 'تقرير معدل الدوران', description: 'Resignations, terminations, and turnover rate', collection: 'cvision_employees', defaultFields: ['name', 'department', 'status', 'terminationDate', 'reason', 'tenure'] },
  { key: 'leave-balance', name: 'Leave Balance Report', nameAr: 'تقرير أرصدة الإجازات', description: 'Leave balances per employee', collection: 'cvision_leaves', defaultFields: ['name', 'department', 'leaveType', 'totalDays', 'status'] },
  { key: 'payroll-summary', name: 'Payroll Summary', nameAr: 'ملخص الرواتب', description: 'Total payroll cost by department', collection: 'cvision_payslips', defaultFields: ['department', 'employees', 'totalBasic', 'totalAllowances', 'totalDeductions', 'totalNet'] },
  { key: 'saudization', name: 'Saudization Report', nameAr: 'تقرير السعودة', description: 'Saudi vs Non-Saudi by department with Nitaqat', collection: 'cvision_employees', defaultFields: ['department', 'totalEmployees', 'saudiCount', 'nonSaudiCount', 'saudizationRate'] },
  { key: 'training', name: 'Training Report', nameAr: 'تقرير التدريب', description: 'Training courses, enrollments, and completion rates', collection: 'cvision_training_courses', defaultFields: ['title', 'type', 'enrolled', 'completed', 'completionRate', 'status'] },
  { key: 'recruitment', name: 'Recruitment Pipeline', nameAr: 'خط أنابيب التوظيف', description: 'Job openings, applicants, and hires', collection: 'cvision_job_requisitions', defaultFields: ['title', 'department', 'status', 'applicants', 'shortlisted', 'hired'] },
  { key: 'contract-expiry', name: 'Contract Expiry Report', nameAr: 'تقرير انتهاء العقود', description: 'Contracts expiring in next 90 days', collection: 'cvision_employees', defaultFields: ['name', 'department', 'contractType', 'startDate', 'endDate', 'daysRemaining'] },
  { key: 'document-expiry', name: 'Iqama/Passport Expiry', nameAr: 'تقرير انتهاء الإقامات', description: 'Document expiry tracking', collection: 'cvision_employees', defaultFields: ['name', 'nationality', 'iqamaNumber', 'iqamaExpiry', 'passportExpiry', 'daysRemaining'] },
  { key: 'loan-outstanding', name: 'Loan Outstanding Report', nameAr: 'تقرير القروض', description: 'Active loans and remaining balances', collection: 'cvision_loans', defaultFields: ['employeeName', 'loanType', 'amount', 'paidAmount', 'remainingAmount', 'monthlyDeduction', 'status'] },
  { key: 'performance', name: 'Performance Distribution', nameAr: 'توزيع الأداء', description: 'Performance review scores', collection: 'cvision_review_cycles', defaultFields: ['cycleName', 'employeeName', 'overallScore', 'status', 'period'] },
  { key: 'compensation', name: 'Compensation Analysis', nameAr: 'تحليل التعويضات', description: 'Salary analysis by department and grade', collection: 'cvision_employees', defaultFields: ['department', 'employees', 'avgBasicSalary', 'minSalary', 'maxSalary', 'totalCost'] },
  { key: 'compliance', name: 'Compliance Status', nameAr: 'حالة الامتثال', description: 'Compliance items and their status', collection: 'cvision_policies', defaultFields: ['title', 'category', 'status', 'acknowledgedCount', 'totalEmployees', 'complianceRate'] },
  { key: 'asset-inventory', name: 'Asset Inventory', nameAr: 'جرد الأصول', description: 'All assets with assignment status', collection: 'cvision_assets', defaultFields: ['assetTag', 'name', 'category', 'status', 'condition', 'assignedTo'] },
  { key: 'employee-master', name: 'Employee Master List', nameAr: 'قائمة الموظفين الشاملة', description: 'Complete employee directory export', collection: 'cvision_employees', defaultFields: ['employeeNo', 'name', 'email', 'phone', 'department', 'jobTitle', 'nationality', 'joinDate', 'status'] },
];

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function fmtDate(d: any): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return '—'; }
}
function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}
function empName(e: any): string {
  return e?.fullName || `${e?.firstName || ''} ${e?.lastName || ''}`.trim() || e?.employeeNo || '—';
}

async function buildDeptMap(db: Db, tenantId: string): Promise<Map<string, string>> {
  const depts = await db.collection('cvision_departments').find({ tenantId }).project({ id: 1, name: 1 }).toArray();
  const map = new Map<string, string>();
  for (const d of depts) if (d.id && d.name) map.set(d.id, d.name);
  return map;
}

/* ── Custom Report Generators ────────────────────────────────────────────────── */

async function genHeadcount(db: Db, tenantId: string, _filters: any, groupBy?: string) {
  const deptMap = await buildDeptMap(db, tenantId);
  const emps = await db.collection('cvision_employees').find({ tenantId, isArchived: { $ne: true }, deletedAt: null }).toArray();

  if (groupBy) {
    const groups: Record<string, number> = {};
    for (const e of emps) {
      const key = groupBy === 'department' ? (deptMap.get(e.departmentId) || e.departmentId || 'Unassigned') : e[groupBy] || 'Unknown';
      groups[key] = (groups[key] || 0) + 1;
    }
    const data = Object.entries(groups).sort((a, b) => b[1] - a[1]).map(([_id, count]) => ({ _id, count }));
    return { data, total: data.length, grouped: true };
  }

  const data = emps.map(e => ({
    employeeNo: e.employeeNo || '—',
    name: empName(e),
    department: deptMap.get(e.departmentId) || e.departmentId || '—',
    jobTitle: e.jobTitle || '—',
    nationality: e.nationality || '—',
    status: e.status || '—',
  }));
  return { data, total: data.length, grouped: false };
}

async function genTurnover(db: Db, tenantId: string) {
  const deptMap = await buildDeptMap(db, tenantId);
  const allEmps = await db.collection('cvision_employees').find({ tenantId, isArchived: { $ne: true }, deletedAt: null }).toArray();
  const total = allEmps.length;
  const departed = allEmps.filter(e => ['RESIGNED', 'TERMINATED'].includes(e.status));
  const rate = total > 0 ? Math.round((departed.length / total) * 100) : 0;

  const data = departed.map(e => {
    const joinDate = e.hiredAt || e.joinDate || e.createdAt;
    const endDate = e.terminationDate || e.lastWorkingDay || e.updatedAt;
    const tenureDays = joinDate && endDate ? daysBetween(new Date(joinDate), new Date(endDate)) : 0;
    return {
      name: empName(e),
      department: deptMap.get(e.departmentId) || '—',
      status: e.status,
      terminationDate: fmtDate(endDate),
      reason: e.terminationReason || e.resignationReason || '—',
      tenure: tenureDays > 0 ? `${Math.round(tenureDays / 30)} months` : '—',
    };
  });
  // Add summary row
  data.unshift({ name: `SUMMARY: ${departed.length} departed of ${total} (${rate}% turnover)`, department: '', status: '', terminationDate: '', reason: '', tenure: '' });
  return { data, total: data.length, grouped: false };
}

async function genLeaveBalance(db: Db, tenantId: string) {
  const deptMap = await buildDeptMap(db, tenantId);
  const leaves = await db.collection('cvision_leaves').find({ tenantId }).toArray();
  const emps = await db.collection('cvision_employees').find({ tenantId, status: { $in: ['ACTIVE', 'PROBATION', 'Active'] }, isArchived: { $ne: true }, deletedAt: null }).toArray();
  const empMap = new Map(emps.map(e => [e.id, e]));

  // Group by employee + leaveType
  const byEmp: Record<string, any[]> = {};
  for (const l of leaves) {
    const key = l.employeeId;
    if (!byEmp[key]) byEmp[key] = [];
    byEmp[key].push(l);
  }

  const data: any[] = [];
  for (const [empId, empLeaves] of Object.entries(byEmp)) {
    const emp = empMap.get(empId);
    // Group by type
    const byType: Record<string, any[]> = {};
    for (const l of empLeaves) {
      const t = l.leaveType || l.type || 'ANNUAL';
      if (!byType[t]) byType[t] = [];
      byType[t].push(l);
    }
    for (const [type, tLeaves] of Object.entries(byType)) {
      const totalDays = tLeaves.reduce((s, l) => s + (l.days || l.duration || 0), 0);
      data.push({
        name: emp ? empName(emp) : empId,
        department: emp ? (deptMap.get(emp.departmentId) || '—') : '—',
        leaveType: type.replace(/_/g, ' '),
        totalDays,
        status: tLeaves[tLeaves.length - 1]?.status || '—',
      });
    }
  }

  if (data.length === 0) {
    // Show all active employees with no leaves
    for (const e of emps.slice(0, 50)) {
      data.push({ name: empName(e), department: deptMap.get(e.departmentId) || '—', leaveType: 'ANNUAL', totalDays: 0, status: 'No leaves recorded' });
    }
  }
  return { data, total: data.length, grouped: false };
}

async function genPayrollSummary(db: Db, tenantId: string, _filters: any, groupBy?: string) {
  const deptMap = await buildDeptMap(db, tenantId);
  // Try payslips first, fall back to payroll profiles
  let payslips = await db.collection('cvision_payslips').find({ tenantId }).sort({ createdAt: -1 }).limit(5000).toArray();

  if (payslips.length === 0) {
    // Fall back to payroll profiles (compensation data on employees)
    const emps = await db.collection('cvision_employees').find({ tenantId, status: { $in: ['ACTIVE', 'PROBATION', 'Active'] }, isArchived: { $ne: true }, deletedAt: null }).toArray();
    const profiles = await db.collection('cvision_payroll_profiles').find({ tenantId }).toArray();
    const profileMap = new Map(profiles.map(p => [p.employeeId, p]));

    const byDept: Record<string, { count: number; basic: number; allowances: number; deductions: number; net: number }> = {};
    for (const e of emps) {
      const dept = deptMap.get(e.departmentId) || 'Unassigned';
      const p = profileMap.get(e.id);
      if (!byDept[dept]) byDept[dept] = { count: 0, basic: 0, allowances: 0, deductions: 0, net: 0 };
      byDept[dept].count++;
      const basic = p?.basicSalary || e.basicSalary || 0;
      const housing = p?.housingAllowance || e.housingAllowance || 0;
      const transport = p?.transportAllowance || e.transportAllowance || 0;
      const totalAllow = housing + transport + (p?.otherAllowances || 0);
      const totalDed = (p?.gosiEmployee || 0);
      byDept[dept].basic += basic;
      byDept[dept].allowances += totalAllow;
      byDept[dept].deductions += totalDed;
      byDept[dept].net += basic + totalAllow - totalDed;
    }
    const data = Object.entries(byDept).sort((a, b) => b[1].net - a[1].net).map(([dept, v]) => ({
      department: dept, employees: v.count,
      totalBasic: `${v.basic.toLocaleString()} SAR`, totalAllowances: `${v.allowances.toLocaleString()} SAR`,
      totalDeductions: `${v.deductions.toLocaleString()} SAR`, totalNet: `${v.net.toLocaleString()} SAR`,
    }));
    return { data, total: data.length, grouped: false };
  }

  // Use actual payslips
  const byDept: Record<string, { count: number; basic: number; allowances: number; deductions: number; net: number }> = {};
  for (const p of payslips) {
    const dept = p.departmentName || deptMap.get(p.departmentId) || 'Unknown';
    if (!byDept[dept]) byDept[dept] = { count: 0, basic: 0, allowances: 0, deductions: 0, net: 0 };
    byDept[dept].count++;
    byDept[dept].basic += p.basicSalary || 0;
    byDept[dept].allowances += (p.totalEarnings || 0) - (p.basicSalary || 0);
    byDept[dept].deductions += p.totalDeductions || 0;
    byDept[dept].net += p.netPay || 0;
  }
  const data = Object.entries(byDept).sort((a, b) => b[1].net - a[1].net).map(([dept, v]) => ({
    department: dept, employees: v.count,
    totalBasic: `${v.basic.toLocaleString()} SAR`, totalAllowances: `${v.allowances.toLocaleString()} SAR`,
    totalDeductions: `${v.deductions.toLocaleString()} SAR`, totalNet: `${v.net.toLocaleString()} SAR`,
  }));
  return { data, total: data.length, grouped: false };
}

async function genSaudization(db: Db, tenantId: string) {
  const deptMap = await buildDeptMap(db, tenantId);
  const emps = await db.collection('cvision_employees').find({ tenantId, status: { $in: ['ACTIVE', 'PROBATION', 'Active'] }, isArchived: { $ne: true }, deletedAt: null }).toArray();

  const byDept: Record<string, { total: number; saudi: number; nonSaudi: number }> = {};
  for (const e of emps) {
    const dept = deptMap.get(e.departmentId) || 'Unassigned';
    if (!byDept[dept]) byDept[dept] = { total: 0, saudi: 0, nonSaudi: 0 };
    byDept[dept].total++;
    const nat = (e.nationality || '').toLowerCase();
    if (nat === 'saudi' || nat === 'sa' || nat === 'saudi arabian' || nat === 'سعودي') byDept[dept].saudi++;
    else byDept[dept].nonSaudi++;
  }
  const totalSaudi = Object.values(byDept).reduce((s, v) => s + v.saudi, 0);
  const totalAll = emps.length;
  const data = Object.entries(byDept).sort((a, b) => b[1].total - a[1].total).map(([dept, v]) => ({
    department: dept, totalEmployees: v.total,
    saudiCount: v.saudi, nonSaudiCount: v.nonSaudi,
    saudizationRate: v.total > 0 ? `${Math.round((v.saudi / v.total) * 100)}%` : '0%',
  }));
  // Summary row
  data.push({
    department: `TOTAL (${totalAll} employees)`, totalEmployees: totalAll,
    saudiCount: totalSaudi, nonSaudiCount: totalAll - totalSaudi,
    saudizationRate: totalAll > 0 ? `${Math.round((totalSaudi / totalAll) * 100)}%` : '0%',
  });
  return { data, total: data.length, grouped: false };
}

async function genTraining(db: Db, tenantId: string) {
  const courses = await db.collection('cvision_training_courses').find({ tenantId }).toArray();
  const enrollments = await db.collection('cvision_training_enrollments').find({ tenantId }).toArray();

  // Count enrollments per course
  const enrollByC: Record<string, { enrolled: number; completed: number }> = {};
  for (const e of enrollments) {
    const cid = e.courseId;
    if (!enrollByC[cid]) enrollByC[cid] = { enrolled: 0, completed: 0 };
    enrollByC[cid].enrolled++;
    if (e.status === 'COMPLETED') enrollByC[cid].completed++;
  }

  const data = courses.map((c: any) => {
    const stats = enrollByC[c.courseId] || { enrolled: 0, completed: 0 };
    return {
      title: c.title || '—',
      type: (c.type || '—').replace(/_/g, ' '),
      enrolled: stats.enrolled,
      completed: stats.completed,
      completionRate: stats.enrolled > 0 ? `${Math.round((stats.completed / stats.enrolled) * 100)}%` : '0%',
      status: c.status || '—',
    };
  });
  return { data, total: data.length, grouped: false };
}

async function genRecruitment(db: Db, tenantId: string) {
  const deptMap = await buildDeptMap(db, tenantId);
  const reqs = await db.collection('cvision_job_requisitions').find({ tenantId }).toArray();
  const candidates = await db.collection('cvision_candidates').find({ tenantId }).toArray();

  // Count candidates per requisition
  const candByReq: Record<string, { total: number; shortlisted: number; hired: number }> = {};
  for (const c of candidates) {
    const rid = c.requisitionId || c.jobId;
    if (!rid) continue;
    if (!candByReq[rid]) candByReq[rid] = { total: 0, shortlisted: 0, hired: 0 };
    candByReq[rid].total++;
    if (['SHORTLISTED', 'INTERVIEW', 'OFFER'].includes(c.stage || c.status)) candByReq[rid].shortlisted++;
    if (['HIRED', 'ACCEPTED'].includes(c.stage || c.status)) candByReq[rid].hired++;
  }

  const data = reqs.map((r: any) => {
    const stats = candByReq[r.requisitionId || r.id] || { total: 0, shortlisted: 0, hired: 0 };
    return {
      title: r.title || r.jobTitle || '—',
      department: deptMap.get(r.departmentId) || r.departmentName || '—',
      status: r.status || '—',
      applicants: stats.total,
      shortlisted: stats.shortlisted,
      hired: stats.hired,
    };
  });

  if (data.length === 0) {
    // Try job postings
    const postings = await db.collection('cvision_job_postings').find({ tenantId }).toArray();
    for (const p of postings) {
      data.push({
        title: p.title || '—', department: deptMap.get(p.departmentId) || '—',
        status: p.status || '—', applicants: p.applicantsCount || 0, shortlisted: 0, hired: 0,
      });
    }
  }
  return { data, total: data.length, grouped: false };
}

async function genContractExpiry(db: Db, tenantId: string) {
  const deptMap = await buildDeptMap(db, tenantId);
  const now = new Date();
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  // Check contracts collection first
  let contracts = await db.collection('cvision_contracts').find({
    tenantId, endDate: { $gte: now, $lte: in90 },
  }).toArray();

  if (contracts.length > 0) {
    const empIds = contracts.map((c: any) => c.employeeId).filter(Boolean);
    const emps = await db.collection('cvision_employees').find({ tenantId, id: { $in: empIds }, deletedAt: null }).toArray();
    const empMap = new Map(emps.map(e => [e.id, e]));
    const data = contracts.map((c: any) => {
      const emp = empMap.get(c.employeeId);
      return {
        name: emp ? empName(emp) : c.employeeId,
        department: emp ? (deptMap.get(emp.departmentId) || '—') : '—',
        contractType: c.contractType || c.type || '—',
        startDate: fmtDate(c.startDate), endDate: fmtDate(c.endDate),
        daysRemaining: daysBetween(now, new Date(c.endDate)),
      };
    }).sort((a: any, b: any) => a.daysRemaining - b.daysRemaining);
    return { data, total: data.length, grouped: false };
  }

  // Fall back to employee contractEndDate
  const emps = await db.collection('cvision_employees').find({
    tenantId, isArchived: { $ne: true }, deletedAt: null,
    $or: [
      { contractEndDate: { $gte: now, $lte: in90 } },
      { 'employment.contractEndDate': { $gte: now, $lte: in90 } },
    ],
  }).toArray();
  const data = emps.map(e => ({
    name: empName(e), department: deptMap.get(e.departmentId) || '—',
    contractType: e.contractType || '—',
    startDate: fmtDate(e.contractStartDate || e.hiredAt || e.joinDate),
    endDate: fmtDate(e.contractEndDate),
    daysRemaining: e.contractEndDate ? daysBetween(now, new Date(e.contractEndDate)) : '—',
  }));

  if (data.length === 0) {
    // Show all active employees with no contract data
    const allEmps = await db.collection('cvision_employees').find({ tenantId, isArchived: { $ne: true }, deletedAt: null, status: { $in: ['ACTIVE', 'PROBATION'] } }).limit(20).toArray();
    for (const e of allEmps) {
      data.push({ name: empName(e), department: deptMap.get(e.departmentId) || '—', contractType: '—', startDate: fmtDate(e.hiredAt || e.joinDate), endDate: 'No contract end date', daysRemaining: '—' });
    }
  }
  return { data, total: data.length, grouped: false };
}

async function genDocumentExpiry(db: Db, tenantId: string) {
  const now = new Date();
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const emps = await db.collection('cvision_employees').find({ tenantId, isArchived: { $ne: true }, deletedAt: null }).toArray();

  const data: any[] = [];
  for (const e of emps) {
    const iqExp = e.iqamaExpiry || e.iqamaExpiryDate;
    const ppExp = e.passportExpiry || e.passportExpiryDate;
    if (iqExp || ppExp) {
      const iqDate = iqExp ? new Date(iqExp) : null;
      const ppDate = ppExp ? new Date(ppExp) : null;
      const nearestExpiry = [iqDate, ppDate].filter(Boolean).sort((a, b) => a!.getTime() - b!.getTime())[0];
      if (nearestExpiry && nearestExpiry <= in90) {
        data.push({
          name: empName(e), nationality: e.nationality || '—',
          iqamaNumber: e.iqamaNumber || '—',
          iqamaExpiry: fmtDate(iqExp), passportExpiry: fmtDate(ppExp),
          daysRemaining: daysBetween(now, nearestExpiry),
        });
      }
    }
  }
  data.sort((a, b) => a.daysRemaining - b.daysRemaining);
  if (data.length === 0) {
    for (const e of emps.slice(0, 20)) {
      data.push({
        name: empName(e), nationality: e.nationality || '—',
        iqamaNumber: e.iqamaNumber || '—',
        iqamaExpiry: fmtDate(e.iqamaExpiry), passportExpiry: fmtDate(e.passportExpiry),
        daysRemaining: '—',
      });
    }
  }
  return { data, total: data.length, grouped: false };
}

async function genLoanOutstanding(db: Db, tenantId: string) {
  const loans = await db.collection('cvision_loans').find({ tenantId, status: 'ACTIVE' }).toArray();
  const empIds = [...new Set(loans.map(l => l.employeeId).filter(Boolean))];
  const emps = await db.collection('cvision_employees').find({ tenantId, id: { $in: empIds }, deletedAt: null }).toArray();
  const empMap = new Map(emps.map(e => [e.id, e]));

  const data = loans.map((l: any) => ({
    employeeName: empMap.has(l.employeeId) ? empName(empMap.get(l.employeeId)) : l.employeeName || l.employeeId,
    loanType: (l.loanType || l.type || '—').replace(/_/g, ' '),
    amount: `${(l.principal || l.amount || 0).toLocaleString()} SAR`,
    paidAmount: `${((l.principal || l.amount || 0) - (l.remaining || 0)).toLocaleString()} SAR`,
    remainingAmount: `${(l.remaining || 0).toLocaleString()} SAR`,
    monthlyDeduction: `${(l.monthlyDeduction || 0).toLocaleString()} SAR`,
    status: l.status,
  }));
  return { data, total: data.length, grouped: false };
}

async function genPerformance(db: Db, tenantId: string) {
  const cycles = await db.collection('cvision_review_cycles').find({ tenantId }).sort({ createdAt: -1 }).toArray();
  const allRevIds = [...new Set(cycles.flatMap((c: any) => (c.reviews || []).map((r: any) => r.employeeId)).filter(Boolean))];
  const emps = await db.collection('cvision_employees').find({ tenantId, id: { $in: allRevIds }, deletedAt: null }).project({ id: 1, firstName: 1, lastName: 1, fullName: 1 }).toArray();
  const nm = new Map(emps.map(e => [e.id, e.fullName || `${e.firstName || ''} ${e.lastName || ''}`.trim()]));

  const data: any[] = [];
  for (const c of cycles) {
    for (const r of c.reviews || []) {
      data.push({
        cycleName: c.name || '—',
        employeeName: nm.get(r.employeeId) || r.employeeId,
        overallScore: r.overallScore != null ? `${r.overallScore}%` : '—',
        status: r.status || '—',
        period: c.period || '—',
      });
    }
    // If no reviews, show cycle info
    if (!(c.reviews || []).length) {
      data.push({ cycleName: c.name || '—', employeeName: '—', overallScore: '—', status: c.status || '—', period: c.period || '—' });
    }
  }
  return { data, total: data.length, grouped: false };
}

async function genCompensation(db: Db, tenantId: string) {
  const deptMap = await buildDeptMap(db, tenantId);
  const emps = await db.collection('cvision_employees').find({ tenantId, isArchived: { $ne: true }, deletedAt: null, status: { $in: ['ACTIVE', 'PROBATION', 'Active'] } }).toArray();
  const profiles = await db.collection('cvision_payroll_profiles').find({ tenantId }).toArray();
  const profileMap = new Map(profiles.map(p => [p.employeeId, p]));

  const byDept: Record<string, { count: number; salaries: number[]; total: number }> = {};
  for (const e of emps) {
    const dept = deptMap.get(e.departmentId) || 'Unassigned';
    const p = profileMap.get(e.id);
    const salary = p?.basicSalary || e.basicSalary || 0;
    if (!byDept[dept]) byDept[dept] = { count: 0, salaries: [], total: 0 };
    byDept[dept].count++;
    if (salary > 0) byDept[dept].salaries.push(salary);
    byDept[dept].total += salary;
  }

  const data = Object.entries(byDept).sort((a, b) => b[1].total - a[1].total).map(([dept, v]) => ({
    department: dept, employees: v.count,
    avgBasicSalary: v.salaries.length > 0 ? `${Math.round(v.salaries.reduce((a, b) => a + b, 0) / v.salaries.length).toLocaleString()} SAR` : '—',
    minSalary: v.salaries.length > 0 ? `${Math.min(...v.salaries).toLocaleString()} SAR` : '—',
    maxSalary: v.salaries.length > 0 ? `${Math.max(...v.salaries).toLocaleString()} SAR` : '—',
    totalCost: `${v.total.toLocaleString()} SAR`,
  }));
  return { data, total: data.length, grouped: false };
}

async function genCompliance(db: Db, tenantId: string) {
  // Try policies first
  const policies = await db.collection('cvision_policies').find({ tenantId }).toArray();
  const acks = await db.collection('cvision_policy_acknowledgments').find({ tenantId }).toArray();
  const totalEmps = await db.collection('cvision_employees').countDocuments({ tenantId, isArchived: { $ne: true }, deletedAt: null, status: { $in: ['ACTIVE', 'PROBATION', 'Active'] } });

  const ackByPolicy: Record<string, number> = {};
  for (const a of acks) {
    const pid = a.policyId;
    ackByPolicy[pid] = (ackByPolicy[pid] || 0) + 1;
  }

  const data = policies.map((p: any) => ({
    title: p.title || p.name || '—',
    category: p.category || p.type || '—',
    status: p.status || 'ACTIVE',
    acknowledgedCount: ackByPolicy[p.policyId || p.id] || 0,
    totalEmployees: totalEmps,
    complianceRate: totalEmps > 0 ? `${Math.round(((ackByPolicy[p.policyId || p.id] || 0) / totalEmps) * 100)}%` : '0%',
  }));

  if (data.length === 0) {
    data.push({ title: 'No policies configured', category: '—', status: '—', acknowledgedCount: 0, totalEmployees: totalEmps, complianceRate: '—' });
  }
  return { data, total: data.length, grouped: false };
}

async function genAssetInventory(db: Db, tenantId: string) {
  const assets = await db.collection('cvision_assets').find({ tenantId }).toArray();
  const empIds = [...new Set(assets.map((a: any) => a.assignedTo || a.employeeId).filter(Boolean))];
  const emps = await db.collection('cvision_employees').find({ tenantId, id: { $in: empIds }, deletedAt: null }).toArray();
  const empMap = new Map(emps.map(e => [e.id, e]));

  const data = assets.map((a: any) => ({
    assetTag: a.assetTag || a.assetId || '—',
    name: a.name || a.description || '—',
    category: (a.category || a.type || '—').replace(/_/g, ' '),
    status: a.status || '—',
    condition: a.condition || '—',
    assignedTo: a.assignedTo ? (empMap.has(a.assignedTo) ? empName(empMap.get(a.assignedTo)) : a.assignedTo) : 'Unassigned',
  }));

  if (data.length === 0) {
    data.push({ assetTag: '—', name: 'No assets registered', category: '—', status: '—', condition: '—', assignedTo: '—' });
  }
  return { data, total: data.length, grouped: false };
}

async function genEmployeeMaster(db: Db, tenantId: string) {
  const deptMap = await buildDeptMap(db, tenantId);
  const emps = await db.collection('cvision_employees').find({ tenantId, isArchived: { $ne: true }, deletedAt: null }).toArray();

  const data = emps.map(e => ({
    employeeNo: e.employeeNo || '—',
    name: empName(e),
    email: e.email || '—',
    phone: e.phone || e.mobile || '—',
    department: deptMap.get(e.departmentId) || '—',
    jobTitle: e.jobTitle || '—',
    nationality: e.nationality || '—',
    joinDate: fmtDate(e.hiredAt || e.joinDate),
    status: e.status || '—',
  }));
  return { data, total: data.length, grouped: false };
}

/* ── Main Generator (dispatches to custom handlers) ──────────────────────────── */

const GENERATORS: Record<string, (db: Db, tenantId: string, filters: any, groupBy?: string) => Promise<any>> = {
  'headcount': genHeadcount,
  'turnover': genTurnover,
  'leave-balance': genLeaveBalance,
  'payroll-summary': genPayrollSummary,
  'saudization': genSaudization,
  'training': genTraining,
  'recruitment': genRecruitment,
  'contract-expiry': genContractExpiry,
  'document-expiry': genDocumentExpiry,
  'loan-outstanding': genLoanOutstanding,
  'performance': genPerformance,
  'compensation': genCompensation,
  'compliance': genCompliance,
  'asset-inventory': genAssetInventory,
  'employee-master': genEmployeeMaster,
};

export async function generateReport(db: Db, tenantId: string, options: {
  collection: string;
  fields: string[];
  filters?: { field: string; operator: string; value: any }[];
  groupBy?: string;
  sortBy?: string;
  page?: number;
  pageSize?: number;
  templateKey?: string;
}) {
  const { fields, filters, groupBy, sortBy, page = 1, pageSize = 500, templateKey } = options;

  // Use custom generator if available
  if (templateKey && GENERATORS[templateKey]) {
    return GENERATORS[templateKey](db, tenantId, filters, groupBy);
  }

  // Generic fallback
  const { collection } = options;
  const col = db.collection(collection);
  const match: any = { tenantId };

  if (filters) {
    for (const f of filters) {
      if (f.operator === 'eq') match[f.field] = f.value;
      else if (f.operator === 'ne') match[f.field] = { $ne: f.value };
      else if (f.operator === 'gte') match[f.field] = { ...(match[f.field] || {}), $gte: new Date(f.value) };
      else if (f.operator === 'lte') match[f.field] = { ...(match[f.field] || {}), $lte: new Date(f.value) };
      else if (f.operator === 'contains') match[f.field] = new RegExp(f.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
  }

  if (groupBy) {
    const pipeline: any[] = [
      { $match: match },
      { $group: { _id: `$${groupBy}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ];
    const grouped = await col.aggregate(pipeline).toArray();
    return { data: grouped, total: grouped.length, page: 1, pageSize: grouped.length, grouped: true };
  }

  const total = await col.countDocuments(match);
  const projection = fields.reduce<Record<string, 1>>((p, f) => { p[f] = 1; return p; }, {});
  const sort: any = sortBy ? { [sortBy.replace('-', '')]: sortBy.startsWith('-') ? -1 : 1 } : { createdAt: -1 };
  const skip = (page - 1) * pageSize;
  const data = await col.find(match, { projection }).sort(sort).skip(skip).limit(pageSize).toArray();

  return { data, total, page, pageSize, grouped: false };
}
