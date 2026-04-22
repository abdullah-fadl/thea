import type { Db } from '@/lib/cvision/infra/mongo-compat';
import { GOSI_RATES } from '@/lib/cvision/gosi';

/**
 * Demo seed-data generator.
 *
 * Creates 50 employees with 6 months of attendance, leave,
 * payroll, recruitment, training, insurance, and loan data.
 */

/* ── Name Pools ────────────────────────────────────────────────────── */

const SAUDI_MALE = ['Ahmed Al-Harbi', 'Mohammed Al-Otaibi', 'Khalid Al-Ghamdi', 'Abdullah Al-Dosari',
  'Faisal Al-Mutairi', 'Sultan Al-Shehri', 'Saud Al-Qahtani', 'Nasser Al-Zahrani',
  'Omar Al-Malki', 'Turki Al-Shamrani', 'Ibrahim Al-Rashidi', 'Bandar Al-Yami',
  'Waleed Al-Juhani', 'Hamad Al-Enezi', 'Fahad Al-Subaie'];

const SAUDI_FEMALE = ['Noura Al-Ahmed', 'Sara Al-Harbi', 'Fatimah Al-Ghamdi', 'Maha Al-Qahtani',
  'Reem Al-Otaibi', 'Lama Al-Dosari', 'Amal Al-Shehri', 'Haya Al-Mutairi',
  'Dalal Al-Zahrani', 'Asma Al-Malki'];

const EXPAT_MALE = ['Rajesh Kumar', 'John Santos', 'Mohamed Hassan', 'Ali Reza',
  'Arjun Sharma', 'Carlos Garcia', 'Hamza Youssef', 'James Wilson'];

const EXPAT_FEMALE = ['Maria Santos', 'Priya Patel', 'Fatma Mohamed', 'Ana Garcia', 'Jenny Cruz'];

const DEPARTMENTS = [
  { name: 'Human Resources', nameAr: 'الموارد البشرية', code: 'HR' },
  { name: 'Information Technology', nameAr: 'تقنية المعلومات', code: 'IT' },
  { name: 'Finance', nameAr: 'المالية', code: 'FIN' },
  { name: 'Nursing', nameAr: 'التمريض', code: 'NUR' },
  { name: 'Administration', nameAr: 'الإدارة', code: 'ADM' },
];

const POSITIONS = [
  'Manager', 'Senior Specialist', 'Specialist', 'Coordinator', 'Analyst',
  'Team Lead', 'Associate', 'Officer', 'Supervisor', 'Director',
];

const NATIONALITIES = {
  saudi: ['Saudi'],
  expat: ['Egyptian', 'Indian', 'Filipino', 'Pakistani', 'Jordanian'],
};

/* ── Helpers ───────────────────────────────────────────────────────── */

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateNationalId(isSaudi: boolean): string {
  const prefix = isSaudi ? '1' : '2';
  let digits = prefix;
  for (let i = 0; i < 9; i++) digits += Math.floor(Math.random() * 10).toString();
  return digits;
}

function generatePhone(): string {
  return `+9665${randInt(10000000, 99999999)}`;
}

function generateEmail(name: string, domain: string): string {
  return name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '') + `@${domain}.com`;
}

/* ── Employee Generator ────────────────────────────────────────────── */

function generateEmployees(count: number, tenantId: string): any[] {
  const employees: any[] = [];
  const saudiCount = Math.ceil(count * 0.6);

  for (let i = 0; i < count; i++) {
    const isSaudi = i < saudiCount;
    const isMale = Math.random() > 0.35;
    const namePool = isSaudi
      ? (isMale ? SAUDI_MALE : SAUDI_FEMALE)
      : (isMale ? EXPAT_MALE : EXPAT_FEMALE);

    const name = pick(namePool);
    const dept = pick(DEPARTMENTS);
    const basicSalary = randInt(5000, 25000);
    const housingPct = isSaudi ? 0.25 : 0.20;
    const joinDate = randomDate(new Date('2019-01-01'), new Date('2025-06-01'));

    employees.push({
      tenantId,
      employeeId: `EMP-${String(i + 1).padStart(4, '0')}`,
      name,
      email: generateEmail(name, 'company'),
      phone: generatePhone(),
      nationalId: generateNationalId(isSaudi),
      nationality: isSaudi ? 'Saudi' : pick(NATIONALITIES.expat),
      gender: isMale ? 'MALE' : 'FEMALE',
      dateOfBirth: randomDate(new Date('1970-01-01'), new Date('2000-12-31')),
      department: dept.name,
      departmentCode: dept.code,
      position: pick(POSITIONS),
      joinDate,
      contractEndDate: new Date(joinDate.getTime() + 2 * 365.25 * 24 * 60 * 60 * 1000),
      probationMonths: 3,
      basicSalary,
      housingAllowance: Math.round(basicSalary * housingPct),
      transportAllowance: 1000,
      otherAllowances: randInt(0, 2000),
      bankIBAN: `SA${randInt(10, 99)}80${String(randInt(100000000, 999999999))}${String(randInt(100000000, 999999999))}`.substring(0, 24),
      status: 'ACTIVE',
      iqamaExpiry: isSaudi ? null : randomDate(new Date('2026-01-01'), new Date('2028-12-31')),
      emergencyContact: { name: 'Emergency Contact', phone: generatePhone() },
      createdAt: joinDate,
      updatedAt: new Date(),
    });
  }
  return employees;
}

/* ── Attendance Generator ──────────────────────────────────────────── */

function generateAttendance(employees: any[], days: number): any[] {
  const records: any[] = [];
  const now = new Date();

  for (const emp of employees) {
    for (let d = 0; d < days; d++) {
      const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 5 || dayOfWeek === 6) continue; // Fri/Sat off

      const isAbsent = Math.random() < 0.03;
      const isLate = !isAbsent && Math.random() < 0.08;

      records.push({
        tenantId: emp.tenantId,
        employeeId: emp.employeeId,
        employeeName: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
        date: date.toISOString().slice(0, 10),
        status: isAbsent ? 'ABSENT' : isLate ? 'LATE' : 'PRESENT',
        clockIn: isAbsent ? null : `0${isLate ? 8 : 7}:${randInt(0, 59).toString().padStart(2, '0')}`,
        clockOut: isAbsent ? null : `1${randInt(6, 8)}:${randInt(0, 59).toString().padStart(2, '0')}`,
        createdAt: date,
      });
    }
  }
  return records;
}

/* ── Leave Generator ───────────────────────────────────────────────── */

function generateLeaves(employees: any[], months: number): any[] {
  const records: any[] = [];
  const types = ['ANNUAL', 'SICK', 'PERSONAL', 'EMERGENCY'];

  for (const emp of employees) {
    const leaveCount = randInt(0, Math.ceil(months / 2));
    for (let i = 0; i < leaveCount; i++) {
      const startDate = randomDate(
        new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000),
        new Date(),
      );
      const days = randInt(1, 5);
      const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

      records.push({
        tenantId: emp.tenantId,
        employeeId: emp.employeeId,
        employeeName: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
        leaveType: pick(types),
        startDate, endDate, days,
        status: pick(['APPROVED', 'APPROVED', 'APPROVED', 'PENDING', 'REJECTED']),
        reason: 'Personal reasons',
        createdAt: startDate,
      });
    }
  }
  return records;
}

/* ── Job & Candidate Generator ─────────────────────────────────────── */

function generateJobs(count: number, tenantId: string): any[] {
  const titles = ['Staff Nurse', 'Software Engineer', 'Accountant', 'HR Coordinator', 'IT Support Specialist'];
  return titles.slice(0, count).map((title, i) => ({
    tenantId,
    jobId: `JOB-${String(i + 1).padStart(3, '0')}`,
    title,
    department: pick(DEPARTMENTS).name,
    status: pick(['Open', 'Open', 'Open', 'Closed']),
    openDate: randomDate(new Date('2025-06-01'), new Date('2025-12-01')),
    vacancies: randInt(1, 3),
    applicants: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

function generateCandidates(count: number, jobs: any[], tenantId: string): any[] {
  const stages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];
  const candidates: any[] = [];
  for (let i = 0; i < count; i++) {
    const job = pick(jobs);
    const name = pick([...SAUDI_MALE, ...EXPAT_MALE, ...SAUDI_FEMALE, ...EXPAT_FEMALE]);
    candidates.push({
      tenantId,
      candidateId: `CND-${String(i + 1).padStart(4, '0')}`,
      name,
      email: generateEmail(name, 'mail'),
      phone: generatePhone(),
      jobId: job.jobId,
      position: job.title,
      stage: pick(stages),
      appliedDate: randomDate(new Date('2025-08-01'), new Date()),
      createdAt: new Date(),
    });
  }
  return candidates;
}

/* ── Payroll Generator ─────────────────────────────────────────────── */

function generatePayroll(employees: any[], months: number): any[] {
  const records: any[] = [];
  const now = new Date();

  for (let m = 0; m < months; m++) {
    const periodDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const period = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, '0')}`;

    for (const emp of employees) {
      const gross = (emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.otherAllowances || 0);
      const gosiRate = emp.nationality === 'Saudi' ? GOSI_RATES.EMPLOYEE_RATE : 0;
      const gosiBase = (emp.basicSalary || 0) + (emp.housingAllowance || 0);
      const gosiDeduction = Math.round(gosiBase * gosiRate);

      records.push({
        tenantId: emp.tenantId,
        employeeId: emp.employeeId,
        employeeName: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
        period,
        basicSalary: emp.basicSalary,
        housingAllowance: emp.housingAllowance,
        transportAllowance: emp.transportAllowance,
        otherAllowances: emp.otherAllowances,
        grossSalary: gross,
        gosiDeduction,
        netSalary: gross - gosiDeduction,
        status: 'PAID',
        paidAt: periodDate,
        createdAt: periodDate,
      });
    }
  }
  return records;
}

/* ── Training Generator ────────────────────────────────────────────── */

function generateTraining(tenantId: string): any[] {
  return [
    { tenantId, courseId: 'TRN-001', name: 'Fire Safety', category: 'Safety', durationHours: 8, status: 'ACTIVE', createdAt: new Date() },
    { tenantId, courseId: 'TRN-002', name: 'HIPAA Compliance', category: 'Compliance', durationHours: 4, status: 'ACTIVE', createdAt: new Date() },
    { tenantId, courseId: 'TRN-003', name: 'Leadership Development', category: 'Management', durationHours: 16, status: 'ACTIVE', createdAt: new Date() },
    { tenantId, courseId: 'TRN-004', name: 'Excel Advanced', category: 'Technical', durationHours: 8, status: 'ACTIVE', createdAt: new Date() },
    { tenantId, courseId: 'TRN-005', name: 'Customer Service', category: 'Soft Skills', durationHours: 6, status: 'ACTIVE', createdAt: new Date() },
  ];
}

/* ── Main Seed Function ────────────────────────────────────────────── */

export async function seedDemoData(db: Db, tenantId: string) {
  const employees = generateEmployees(50, tenantId);
  const attendance = generateAttendance(employees, 180);
  const leaves = generateLeaves(employees, 6);
  const payroll = generatePayroll(employees, 6);
  const jobs = generateJobs(5, tenantId);
  const candidates = generateCandidates(30, jobs, tenantId);
  const training = generateTraining(tenantId);

  const inserts: { collection: string; count: number }[] = [];

  async function ins(coll: string, docs: any[]) {
    if (docs.length === 0) return;
    await db.collection(coll).insertMany(docs);
    inserts.push({ collection: coll, count: docs.length });
  }

  await ins('cvision_departments', DEPARTMENTS.map(d => ({ ...d, tenantId, createdAt: new Date() })));
  await ins('cvision_employees', employees);
  await ins('cvision_attendance', attendance);
  await ins('cvision_leaves', leaves);
  await ins('cvision_payroll', payroll);
  await ins('cvision_jobs', jobs);
  await ins('cvision_candidates', candidates);
  await ins('cvision_training_courses', training);

  return {
    success: true,
    inserts,
    summary: {
      employees: employees.length,
      attendance: attendance.length,
      leaves: leaves.length,
      payroll: payroll.length,
      jobs: jobs.length,
      candidates: candidates.length,
      training: training.length,
    },
  };
}

/* ── Clear All Data ────────────────────────────────────────────────── */

export async function clearAllData(db: Db, tenantId: string) {
  const collections = await db.listCollections().toArray();
  const deleted: { collection: string; count: number }[] = [];

  for (const col of collections) {
    if (col.name.startsWith('cvision_')) {
      const result = await db.collection(col.name).deleteMany({ tenantId });
      if (result.deletedCount > 0) {
        deleted.push({ collection: col.name, count: result.deletedCount });
      }
    }
  }

  return { success: true, deleted };
}

/* ── Check if Demo Data Exists ─────────────────────────────────────── */

export async function seedStatus(db: Db, tenantId: string) {
  const empCount = await db.collection('cvision_employees').countDocuments({ tenantId });
  const attCount = await db.collection('cvision_attendance').countDocuments({ tenantId });
  const deptCount = await db.collection('cvision_departments').countDocuments({ tenantId });

  return {
    hasData: empCount > 0,
    counts: { employees: empCount, attendance: attCount, departments: deptCount },
  };
}
