import type { Db, Document } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export type CourseCategory = 'TECHNICAL' | 'LEADERSHIP' | 'COMPLIANCE' | 'SAFETY' | 'SOFT_SKILLS' | 'CERTIFICATION' | 'ONBOARDING' | 'CUSTOM';
export type DeliveryMethod = 'CLASSROOM' | 'VIRTUAL' | 'E_LEARNING' | 'ON_THE_JOB' | 'WORKSHOP' | 'CONFERENCE' | 'BLENDED';
export type EnrollmentStatus = 'REQUESTED' | 'APPROVED' | 'ENROLLED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'NO_SHOW';

export const CATEGORY_LABELS: Record<CourseCategory, string> = {
  TECHNICAL: 'Technical', LEADERSHIP: 'Leadership', COMPLIANCE: 'Compliance',
  SAFETY: 'Safety', SOFT_SKILLS: 'Soft Skills', CERTIFICATION: 'Certification',
  ONBOARDING: 'Onboarding', CUSTOM: 'Custom',
};

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  CLASSROOM: 'Classroom', VIRTUAL: 'Virtual', E_LEARNING: 'E-Learning',
  ON_THE_JOB: 'On-the-Job', WORKSHOP: 'Workshop', CONFERENCE: 'Conference',
  BLENDED: 'Blended',
};

/* ── Seed Data ─────────────────────────────────────────────────────── */

const SEED_COURSES = [
  {
    courseId: 'CRS-2026-001', title: 'Workplace Safety & Fire Prevention',
    titleAr: 'السلامة في بيئة العمل ومكافحة الحرائق',
    description: 'Mandatory annual safety training covering fire prevention, evacuation procedures, and first aid basics.',
    category: 'SAFETY' as CourseCategory, deliveryMethod: 'CLASSROOM' as DeliveryMethod,
    provider: 'INTERNAL', mandatory: true, durationHours: 8, durationDays: 1,
    costPerPerson: 0, certificationOffered: true, certificationName: 'Workplace Safety Certificate',
    certificationValidityMonths: 12, targetAudience: ['All Departments'],
    sessions: [{
      sessionId: 'SES-001', startDate: new Date('2026-03-15'), endDate: new Date('2026-03-15'),
      time: '09:00 - 17:00', location: 'Main Training Hall', trainer: 'Ahmed Al-Rashid',
      maxCapacity: 30, enrolledCount: 0, status: 'SCHEDULED' as const,
    }],
  },
  {
    courseId: 'CRS-2026-002', title: 'Leadership Development Program',
    titleAr: 'برنامج تطوير القيادات',
    description: 'Comprehensive leadership program for mid-level managers covering strategic thinking, team management, and decision-making.',
    category: 'LEADERSHIP' as CourseCategory, deliveryMethod: 'BLENDED' as DeliveryMethod,
    provider: 'EXTERNAL', providerName: 'Dale Carnegie KSA', mandatory: false,
    durationHours: 40, durationDays: 5, costPerPerson: 8500,
    certificationOffered: true, certificationName: 'Certified Leadership Professional',
    certificationValidityMonths: 24, targetAudience: ['Management'],
    sessions: [{
      sessionId: 'SES-002', startDate: new Date('2026-04-01'), endDate: new Date('2026-04-05'),
      time: '09:00 - 17:00', location: 'Riyadh Business Center', trainer: 'Dr. Sarah Al-Amri',
      maxCapacity: 20, enrolledCount: 0, status: 'SCHEDULED' as const,
    }],
  },
  {
    courseId: 'CRS-2026-003', title: 'HRDF Compliance & Labor Law Update',
    titleAr: 'الامتثال لهدف وتحديثات نظام العمل',
    description: 'Annual compliance training on Saudi Labor Law amendments, HRDF requirements, and Nitaqat updates.',
    category: 'COMPLIANCE' as CourseCategory, deliveryMethod: 'VIRTUAL' as DeliveryMethod,
    provider: 'INTERNAL', mandatory: true, mandatoryFor: ['HR', 'Legal'],
    durationHours: 4, durationDays: 1, costPerPerson: 0,
    certificationOffered: false, targetAudience: ['HR', 'Legal', 'Management'],
    sessions: [{
      sessionId: 'SES-003', startDate: new Date('2026-03-20'), endDate: new Date('2026-03-20'),
      time: '10:00 - 14:00', location: 'Microsoft Teams', trainer: 'Mohammed Al-Zahrani',
      maxCapacity: 50, enrolledCount: 0, status: 'SCHEDULED' as const,
    }],
  },
  {
    courseId: 'CRS-2026-004', title: 'Advanced Excel & Data Analysis',
    titleAr: 'اكسل المتقدم وتحليل البيانات',
    description: 'Hands-on training covering pivot tables, Power Query, advanced formulas, and dashboard creation.',
    category: 'TECHNICAL' as CourseCategory, deliveryMethod: 'WORKSHOP' as DeliveryMethod,
    provider: 'EXTERNAL', providerName: 'New Horizons KSA', mandatory: false,
    durationHours: 16, durationDays: 2, costPerPerson: 2500,
    certificationOffered: true, certificationName: 'Advanced Excel Specialist',
    certificationValidityMonths: 0, targetAudience: ['Finance', 'HR', 'Operations'],
    sessions: [{
      sessionId: 'SES-004', startDate: new Date('2026-04-10'), endDate: new Date('2026-04-11'),
      time: '09:00 - 17:00', location: 'Computer Lab - 3rd Floor', trainer: 'Fatima Hassan',
      maxCapacity: 15, enrolledCount: 0, status: 'SCHEDULED' as const,
    }],
  },
  {
    courseId: 'CRS-2026-005', title: 'Effective Communication Skills',
    titleAr: 'مهارات التواصل الفعال',
    description: 'Improve verbal and written communication, presentation skills, and cross-cultural communication.',
    category: 'SOFT_SKILLS' as CourseCategory, deliveryMethod: 'E_LEARNING' as DeliveryMethod,
    provider: 'EXTERNAL', providerName: 'Coursera for Business', mandatory: false,
    externalUrl: 'https://coursera.org/effective-communication',
    durationHours: 12, durationDays: 0, costPerPerson: 350,
    certificationOffered: true, certificationName: 'Communication Skills Certificate',
    certificationValidityMonths: 0, targetAudience: ['All Departments'],
    sessions: [{
      sessionId: 'SES-005', startDate: new Date('2026-03-01'), endDate: new Date('2026-06-30'),
      time: 'Self-paced', trainer: 'Online Platform',
      maxCapacity: 100, enrolledCount: 0, status: 'SCHEDULED' as const,
    }],
  },
];

export async function ensureSeedData(db: Db, tenantId: string): Promise<void> {
  const count = await db.collection('cvision_training_courses').countDocuments({ tenantId });
  if (count > 0) return;

  const courses = SEED_COURSES.map(c => ({
    ...c, tenantId, status: 'ACTIVE', prerequisites: [], createdAt: new Date(), updatedAt: new Date(),
  }));
  await db.collection('cvision_training_courses').insertMany(courses);

  // Seed enrollments for first few employees
  const employees = await db.collection('cvision_employees').find({
    tenantId, status: { $in: ['ACTIVE', 'Active', 'PROBATION'] }, deletedAt: null,
  }).limit(5).toArray();

  const enrollments: Document[] = [];
  for (let i = 0; i < Math.min(employees.length, 3); i++) {
    const emp = employees[i];
    const course = courses[i % courses.length];
    const session = course.sessions[0];
    enrollments.push({
      tenantId,
      enrollmentId: `ENR-2026-${String(i + 1).padStart(4, '0')}`,
      employeeId: emp.id || emp.employeeId || emp._id?.toString(),
      employeeName: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || '',
      department: emp.department || emp.departmentName || '',
      courseId: course.courseId,
      courseTitle: course.title,
      sessionId: session.sessionId,
      status: ['ENROLLED', 'COMPLETED', 'IN_PROGRESS'][i] as EnrollmentStatus,
      requestedBy: 'HR',
      attendanceRecords: [],
      attendancePercentage: [0, 100, 50][i],
      finalScore: [null, 85, null][i],
      passed: [false, true, false][i],
      certificateIssued: i === 1,
      certificateNumber: i === 1 ? `CERT-${course.courseId}-${emp.id || emp.employeeId}` : undefined,
      certificateExpiryDate: i === 1 && course.certificationValidityMonths
        ? new Date(Date.now() + course.certificationValidityMonths * 30 * 86400000) : undefined,
      cost: course.costPerPerson,
      paidBy: 'COMPANY',
      completedAt: i === 1 ? new Date(Date.now() - 30 * 86400000) : undefined,
      createdAt: new Date(), updatedAt: new Date(),
    });
  }

  if (enrollments.length > 0) {
    await db.collection('cvision_training_enrollments').insertMany(enrollments);
    // Update enrolled counts
    for (const e of enrollments) {
      await db.collection('cvision_training_courses').updateOne(
        { tenantId, courseId: e.courseId, 'sessions.sessionId': e.sessionId },
        { $inc: { 'sessions.$.enrolledCount': 1 } },
      );
    }
  }

  // Seed budget
  const departments = [...new Set(employees.map(e => e.department || e.departmentName || 'General'))];
  const budgets = departments.filter(Boolean).map(dept => ({
    tenantId, year: new Date().getFullYear(), department: dept,
    allocatedBudget: 50000, spentBudget: 0, remainingBudget: 50000,
    enrollmentCount: 0, completionCount: 0, averageCostPerEmployee: 0,
    updatedAt: new Date(),
  }));
  if (budgets.length > 0) {
    await db.collection('cvision_training_budget').insertMany(budgets);
  }
}

/* ── Analytics ─────────────────────────────────────────────────────── */

export async function getTrainingAnalytics(db: Db, tenantId: string) {
  await ensureSeedData(db, tenantId);

  const [totalCourses, activeCourses, totalEnrollments, completedEnrollments, pendingRequests] = await Promise.all([
    db.collection('cvision_training_courses').countDocuments({ tenantId }),
    db.collection('cvision_training_courses').countDocuments({ tenantId, status: 'ACTIVE' }),
    db.collection('cvision_training_enrollments').countDocuments({ tenantId }),
    db.collection('cvision_training_enrollments').countDocuments({ tenantId, status: 'COMPLETED' }),
    db.collection('cvision_training_enrollments').countDocuments({ tenantId, status: { $in: ['REQUESTED'] } }),
  ]);

  const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;

  // Hours & satisfaction
  const enrollments = await db.collection('cvision_training_enrollments').find({ tenantId }).limit(5000).toArray();
  const courses = await db.collection('cvision_training_courses').find({ tenantId }).limit(5000).toArray();
  const courseMap = new Map(courses.map((c) => [c.courseId, c]));

  let totalHours = 0;
  let totalSatisfaction = 0;
  let satisfactionCount = 0;
  let totalCost = 0;
  const byCategory = new Map<string, { count: number; completed: number }>();
  const byDept = new Map<string, { count: number; completed: number; hours: number; cost: number }>();

  for (const e of enrollments) {
    const course = courseMap.get(e.courseId);
    const hours = course?.durationHours || 0;
    if (e.status === 'COMPLETED') totalHours += hours;
    totalCost += e.cost || 0;

    // By category
    const cat = course?.category || 'OTHER';
    if (!byCategory.has(cat)) byCategory.set(cat, { count: 0, completed: 0 });
    const catData = byCategory.get(cat)!;
    catData.count++;
    if (e.status === 'COMPLETED') catData.completed++;

    // By department
    const dept = e.department || 'Unassigned';
    if (!byDept.has(dept)) byDept.set(dept, { count: 0, completed: 0, hours: 0, cost: 0 });
    const deptData = byDept.get(dept)!;
    deptData.count++;
    if (e.status === 'COMPLETED') { deptData.completed++; deptData.hours += hours; }
    deptData.cost += e.cost || 0;

    // Satisfaction
    if (e.feedback?.rating) {
      totalSatisfaction += e.feedback.rating;
      satisfactionCount++;
    }
  }

  const avgSatisfaction = satisfactionCount > 0 ? Math.round((totalSatisfaction / satisfactionCount) * 10) / 10 : 0;

  // Budget
  const budgets = await db.collection('cvision_training_budget').find({ tenantId, year: new Date().getFullYear() }).toArray();
  const totalBudget = budgets.reduce((s: number, b: Document) => s + (b.allocatedBudget || 0), 0);
  const budgetUtilization = totalBudget > 0 ? Math.round((totalCost / totalBudget) * 100) : 0;

  return {
    totalCourses, activeCourses, totalEnrollments, completedEnrollments,
    pendingRequests, completionRate, totalHours, totalCost,
    avgSatisfaction, budgetUtilization, totalBudget,
    byCategory: Array.from(byCategory.entries()).map(([cat, d]) => ({
      category: cat, label: CATEGORY_LABELS[cat as CourseCategory] || cat, ...d,
    })),
    byDepartment: Array.from(byDept.entries()).map(([dept, d]) => ({ department: dept, ...d })),
  };
}

/* ── Mandatory compliance ──────────────────────────────────────────── */

export async function getMandatoryCompliance(db: Db, tenantId: string) {
  const mandatoryCourses = await db.collection('cvision_training_courses').find({
    tenantId, mandatory: true, status: 'ACTIVE',
  }).toArray();

  const employees = await db.collection('cvision_employees').find({
    tenantId, status: { $in: ['ACTIVE', 'Active', 'PROBATION'] }, deletedAt: null,
  }).project({ employeeId: 1, fullName: 1, name: 1, department: 1, departmentName: 1 }).toArray();

  const enrollments = await db.collection('cvision_training_enrollments').find({
    tenantId, courseId: { $in: mandatoryCourses.map((c) => c.courseId) },
  }).toArray();

  const enrollMap = new Map<string, Document[]>();
  for (const e of enrollments) {
    const key = `${e.employeeId}|${e.courseId}`;
    if (!enrollMap.has(key)) enrollMap.set(key, []);
    enrollMap.get(key)!.push(e);
  }

  const compliance: Document[] = [];
  for (const course of mandatoryCourses) {
    const applicable = employees.filter(emp => {
      if (!course.mandatoryFor || course.mandatoryFor.length === 0) return true;
      const dept = emp.department || emp.departmentName || '';
      return course.mandatoryFor.some((mf: string) =>
        dept.toLowerCase().includes(mf.toLowerCase())
      );
    });

    let compliant = 0;
    let nonCompliant = 0;
    const nonCompliantList: Document[] = [];

    for (const emp of applicable) {
      const empId = emp.id || emp.employeeId || emp._id?.toString();
      const key = `${empId}|${course.courseId}`;
      const empEnrollments = enrollMap.get(key) || [];
      const completed = empEnrollments.some((e) => e.status === 'COMPLETED');
      if (completed) { compliant++; }
      else {
        nonCompliant++;
        nonCompliantList.push({
          employeeId: empId,
          fullName: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee',
          department: emp.department || emp.departmentName,
        });
      }
    }

    compliance.push({
      courseId: course.courseId,
      courseTitle: course.title,
      totalApplicable: applicable.length,
      compliant, nonCompliant,
      complianceRate: applicable.length > 0 ? Math.round((compliant / applicable.length) * 100) : 0,
      nonCompliantEmployees: nonCompliantList.slice(0, 10),
    });
  }

  return compliance;
}

/* ── Expiring certificates ─────────────────────────────────────────── */

export async function getExpiringCertificates(db: Db, tenantId: string, days: number = 90) {
  const cutoff = new Date(Date.now() + days * 86400000);
  const now = new Date();

  const expiring = await db.collection('cvision_training_enrollments').find({
    tenantId,
    certificateIssued: true,
    certificateExpiryDate: { $lte: cutoff, $gte: now },
  }).sort({ certificateExpiryDate: 1 }).toArray();

  const expired = await db.collection('cvision_training_enrollments').find({
    tenantId,
    certificateIssued: true,
    certificateExpiryDate: { $lt: now },
  }).sort({ certificateExpiryDate: -1 }).toArray();

  return { expiring, expired };
}
