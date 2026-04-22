import { logger } from '@/lib/monitoring/logger';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface InsuranceProvider {
  tenantId: string;
  providerId: string;
  name: string;
  nameAr?: string;
  type: 'HEALTH' | 'DENTAL' | 'VISION' | 'LIFE' | 'COMPREHENSIVE';
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  website?: string;
  plans: InsurancePlan[];
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
}

export interface InsurancePlan {
  planId: string;
  name: string;
  tier: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'VIP';
  coverageType: 'INDIVIDUAL' | 'FAMILY';
  annualPremium: number;
  monthlyPremium: number;
  maxCoverage: number;
  deductible: number;
  copay: number;
  networkType: 'ALL' | 'PREFERRED' | 'RESTRICTED';
  benefits: string[];
}

export interface CompanyPolicy {
  tenantId: string;
  policyId: string;
  providerId: string;
  providerName: string;
  planId: string;
  planName: string;
  policyNumber: string;
  startDate: Date;
  endDate: Date;
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING_RENEWAL' | 'CANCELLED';
  enrolledCount: number;
  maxEnrolled: number;
  annualCost: number;
  createdAt: Date;
}

export interface EmployeeInsurance {
  tenantId: string;
  employeeId: string;
  policyId: string;
  membershipNumber: string;
  cardNumber: string;
  enrollmentDate: Date;
  expiryDate: Date;
  status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED';
  tier: string;
  dependents: InsuranceDependent[];
  monthlyPremium: number;
  employerContribution: number;
  employeeContribution: number;
}

export interface InsuranceDependent {
  dependentId: string;
  name: string;
  relationship: 'SPOUSE' | 'CHILD' | 'PARENT';
  dateOfBirth: string;
  nationalId?: string;
  membershipNumber?: string;
  status: 'ACTIVE' | 'REMOVED';
  addedAt: Date;
}

export interface InsuranceClaim {
  tenantId: string;
  claimId: string;
  employeeId: string;
  employeeName: string;
  policyId: string;
  membershipNumber: string;
  type: 'OUTPATIENT' | 'INPATIENT' | 'DENTAL' | 'OPTICAL' | 'MATERNITY' | 'EMERGENCY' | 'PHARMACY';
  provider: string;
  diagnosis: string;
  claimDate: Date;
  submittedDate: Date;
  amount: number;
  approvedAmount: number;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED' | 'PAID';
  rejectionReason?: string;
  processedDate?: Date;
  receiptNumber?: string;
  notes?: string;
}

export interface InsuranceRequest {
  tenantId: string;
  requestId: string;
  employeeId: string;
  employeeName: string;
  type: 'ENROLLMENT' | 'ADD_DEPENDENT' | 'REMOVE_DEPENDENT' | 'UPGRADE' | 'CANCELLATION' | 'CARD_REPLACEMENT';
  details: Record<string, unknown>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSED';
  submittedAt: Date;
  processedAt?: Date;
  processedBy?: string;
  notes?: string;
}

/* ── Seed Data ─────────────────────────────────────────────────────── */

export const SEED_PROVIDERS: Omit<InsuranceProvider, 'tenantId' | 'createdAt'>[] = [
  {
    providerId: 'PROV-001', name: 'Bupa Arabia', type: 'COMPREHENSIVE',
    contactPerson: 'Mohammed Al-Rashid', contactEmail: 'corporate@bupa.com.sa', contactPhone: '+966 11 206 8888',
    website: 'https://www.bupa.com.sa', status: 'ACTIVE',
    plans: [
      { planId: 'BUPA-B', name: 'Bupa Basic', tier: 'BASIC', coverageType: 'INDIVIDUAL', annualPremium: 3600, monthlyPremium: 300, maxCoverage: 250000, deductible: 500, copay: 20, networkType: 'PREFERRED', benefits: ['Outpatient', 'Inpatient', 'Emergency', 'Pharmacy'] },
      { planId: 'BUPA-S', name: 'Bupa Standard', tier: 'STANDARD', coverageType: 'FAMILY', annualPremium: 7200, monthlyPremium: 600, maxCoverage: 500000, deductible: 250, copay: 15, networkType: 'ALL', benefits: ['Outpatient', 'Inpatient', 'Emergency', 'Pharmacy', 'Dental', 'Optical'] },
      { planId: 'BUPA-P', name: 'Bupa Premium', tier: 'PREMIUM', coverageType: 'FAMILY', annualPremium: 14400, monthlyPremium: 1200, maxCoverage: 1000000, deductible: 0, copay: 10, networkType: 'ALL', benefits: ['Outpatient', 'Inpatient', 'Emergency', 'Pharmacy', 'Dental', 'Optical', 'Maternity', 'Wellness', 'Mental Health'] },
    ],
  },
  {
    providerId: 'PROV-002', name: 'Medgulf Insurance', type: 'HEALTH',
    contactPerson: 'Sarah Al-Amri', contactEmail: 'corporate@medgulf.com.sa', contactPhone: '+966 11 218 5555',
    website: 'https://www.medgulf.com.sa', status: 'ACTIVE',
    plans: [
      { planId: 'MED-B', name: 'Medgulf Essential', tier: 'BASIC', coverageType: 'INDIVIDUAL', annualPremium: 2400, monthlyPremium: 200, maxCoverage: 150000, deductible: 750, copay: 25, networkType: 'RESTRICTED', benefits: ['Outpatient', 'Inpatient', 'Emergency'] },
      { planId: 'MED-S', name: 'Medgulf Plus', tier: 'STANDARD', coverageType: 'FAMILY', annualPremium: 6000, monthlyPremium: 500, maxCoverage: 400000, deductible: 300, copay: 20, networkType: 'PREFERRED', benefits: ['Outpatient', 'Inpatient', 'Emergency', 'Pharmacy', 'Dental'] },
    ],
  },
  {
    providerId: 'PROV-003', name: 'Tawuniya', type: 'COMPREHENSIVE',
    contactPerson: 'Ahmed Al-Zahrani', contactEmail: 'corporate@tawuniya.com.sa', contactPhone: '+966 11 252 8888',
    website: 'https://www.tawuniya.com.sa', status: 'ACTIVE',
    plans: [
      { planId: 'TAW-S', name: 'Tawuniya Gold', tier: 'STANDARD', coverageType: 'FAMILY', annualPremium: 8400, monthlyPremium: 700, maxCoverage: 500000, deductible: 200, copay: 15, networkType: 'ALL', benefits: ['Outpatient', 'Inpatient', 'Emergency', 'Pharmacy', 'Dental', 'Optical', 'Maternity'] },
      { planId: 'TAW-V', name: 'Tawuniya VIP', tier: 'VIP', coverageType: 'FAMILY', annualPremium: 24000, monthlyPremium: 2000, maxCoverage: 2000000, deductible: 0, copay: 0, networkType: 'ALL', benefits: ['Outpatient', 'Inpatient', 'Emergency', 'Pharmacy', 'Dental', 'Optical', 'Maternity', 'Wellness', 'Mental Health', 'International Coverage', 'Executive Check-up'] },
    ],
  },
];

/* ── Auto-seed ─────────────────────────────────────────────────────── */

export async function ensureSeedData(db: Db, tenantId: string): Promise<void> {
  const count = await db.collection('cvision_insurance_providers').countDocuments({ tenantId });
  if (count > 0) return;

  // PG schema for cvision_insurance_providers has:
  //   id, tenantId, name, nameAr, contactInfo (Json), isActive, createdAt, updatedAt
  // Pack non-column fields (providerId, type, contactPerson, contactEmail, contactPhone,
  // website, plans, status) into the contactInfo JSON column so PrismaShim doesn't strip them.
  //
  // Insert providers one-by-one so we can diagnose failures individually.
  const providerCollection = db.collection('cvision_insurance_providers');
  for (const p of SEED_PROVIDERS) {
    try {
      await providerCollection.insertOne({
        tenantId,
        name: p.name,
        isActive: p.status === 'ACTIVE',
        contactInfo: {
          providerId: p.providerId,
          type: p.type,
          contactPerson: p.contactPerson,
          contactEmail: p.contactEmail,
          contactPhone: p.contactPhone,
          website: p.website,
          plans: p.plans,
          status: p.status,
        },
        createdAt: new Date(),
      });
    } catch (err) {
      logger.error(`[Insurance Seed] Failed to insert provider ${p.name}:`, err);
    }
  }

  // Retrieve the inserted providers to get their PG-generated UUIDs
  const insertedProviders = await providerCollection.find({ tenantId }).toArray();
  if (insertedProviders.length === 0) {
    logger.error('[Insurance Seed] No providers were inserted — seed data failed');
    return;
  }
  // Find the Bupa provider (first provider, PROV-001) by name
  const bupaProvider = insertedProviders.find((p: Record<string, unknown>) => {
    const ci = (typeof p.contactInfo === 'string' ? JSON.parse(p.contactInfo) : p.contactInfo) || {};
    return ci.providerId === 'PROV-001' || p.name === 'Bupa Arabia';
  });
  const bupaProviderId = bupaProvider?.id || bupaProvider?._id?.toString() || '';

  // PG schema for cvision_insurance_policies has:
  //   id, tenantId, providerId, policyNumber, name, type, coverageDetails (Json),
  //   premium, startDate, endDate, isActive, createdAt, updatedAt
  // Pack non-column fields into coverageDetails JSON.
  // Use policyId as the policyNumber (COLUMN_ALIAS maps policyId -> policyNumber in queries).
  // Store extra display/lookup fields in coverageDetails JSON.
  await db.collection('cvision_insurance_policies').insertOne({
    tenantId,
    providerId: bupaProviderId, // PG UUID of the Bupa provider
    policyNumber: 'POL-2026-001', // Also serves as policyId via COLUMN_ALIAS
    name: 'Bupa Standard',
    type: 'medical',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    isActive: true,
    coverageDetails: {
      displayPolicyNumber: 'BUPA-CORP-2026-4521',
      providerName: 'Bupa Arabia',
      planId: 'BUPA-S',
      planName: 'Bupa Standard',
      status: 'ACTIVE',
      enrolledCount: 0,
      maxEnrolled: 50,
      annualCost: 0,
    },
    createdAt: new Date(),
  });

  // Auto-enroll active employees
  const employees = await db.collection('cvision_employees').find({
    tenantId, status: { $in: ['ACTIVE', 'Active', 'PROBATION'] }, deletedAt: null,
  }).toArray();

  const enrollments: Record<string, unknown>[] = [];
  const claims: Record<string, unknown>[] = [];

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    // PG employees use UUID 'id' as primary key
    const empId = emp.id || emp.employeeId || emp._id?.toString();
    const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Employee';
    const num = String(i + 1).padStart(4, '0');

    // PG schema for cvision_employee_insurances:
    //   id, tenantId, employeeId, policyId, enrollmentDate, membershipNumber, dependents (Json), status
    enrollments.push({
      tenantId, employeeId: empId, policyId: 'POL-2026-001',
      membershipNumber: `MEM-${num}`,
      enrollmentDate: new Date('2026-01-15'),
      status: 'ACTIVE',
      dependents: {
        list: [],
        metadata: { cardNumber: `BUPA-${num}`, expiryDate: '2026-12-31', tier: 'STANDARD', monthlyPremium: 600, employerContribution: 500, employeeContribution: 100 },
      },
      createdAt: new Date(),
    });

    // Seed a few claims for first 3 employees
    // PG schema for cvision_insurance_claims:
    //   id, tenantId, employeeId, policyId, claimNumber, claimDate, amount, description, status, attachments, approvedAmount
    if (i < 3) {
      claims.push({
        tenantId,
        claimNumber: `CLM-2026-${num}`, // COLUMN_ALIAS maps claimId -> claimNumber
        employeeId: empId,
        policyId: 'POL-2026-001',
        claimDate: new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000),
        amount: [350, 120, 800][i],
        approvedAmount: [350, 120, 640][i],
        description: ['General Consultation', 'Prescription Medication', 'Dental Cleaning'][i],
        status: ['paid', 'approved', 'approved'][i],
        attachments: {
          employeeName: empName,
          membershipNumber: `MEM-${num}`,
          type: ['OUTPATIENT', 'PHARMACY', 'DENTAL'][i],
          provider: ['King Faisal Hospital', 'Al-Nahdi Pharmacy', 'Dental Clinic'][i],
          diagnosis: ['General Consultation', 'Prescription Medication', 'Dental Cleaning'][i],
        },
        createdAt: new Date(),
      });
    }
  }

  if (enrollments.length > 0) {
    await db.collection('cvision_employee_insurances').insertMany(enrollments);
    // Update policy enrolledCount via coverageDetails (these fields aren't real PG columns)
    // The policyId alias maps to policyNumber column
    await db.collection('cvision_insurance_policies').updateOne(
      { tenantId, policyId: 'POL-2026-001' },
      { $set: { coverageDetails: { enrolledCount: enrollments.length, annualCost: enrollments.length * 7200, providerName: 'Bupa Arabia', planId: 'BUPA-S', planName: 'Bupa Standard', status: 'ACTIVE', maxEnrolled: 50 } } },
    );
  }
  if (claims.length > 0) {
    await db.collection('cvision_insurance_claims').insertMany(claims);
  }
}

/* ── Query Helpers ─────────────────────────────────────────────────── */

export async function getInsuranceSummary(db: Db, tenantId: string) {
  await ensureSeedData(db, tenantId);

  const [totalInsured, totalEmployees, activePolicies, claimsPending, claimsPaid] = await Promise.all([
    db.collection('cvision_employee_insurances').countDocuments({ tenantId, status: 'ACTIVE' }),
    db.collection('cvision_employees').countDocuments({ tenantId, status: { $in: ['ACTIVE', 'Active', 'PROBATION'] } }),
    db.collection('cvision_insurance_policies').countDocuments({ tenantId, status: 'ACTIVE' }),
    db.collection('cvision_insurance_claims').countDocuments({ tenantId, status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
    db.collection('cvision_insurance_claims').countDocuments({ tenantId, status: 'PAID' }),
  ]);

  const costAgg = await db.collection('cvision_employee_insurances').aggregate([
    { $match: { tenantId, status: 'ACTIVE' } },
    { $group: { _id: null, totalMonthly: { $sum: '$monthlyPremium' }, totalEmployer: { $sum: '$employerContribution' }, totalEmployee: { $sum: '$employeeContribution' } } },
  ]).toArray();

  const costs: any = costAgg[0] || { totalMonthly: 0, totalEmployer: 0, totalEmployee: 0 };

  const expiringSoon = await db.collection('cvision_insurance_policies').countDocuments({
    tenantId, status: 'ACTIVE',
    endDate: { $lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), $gte: new Date() },
  });

  return {
    totalInsured, totalEmployees, uninsured: totalEmployees - totalInsured,
    activePolicies, claimsPending, claimsPaid, expiringSoon,
    monthlyCost: costs.totalMonthly, annualCost: costs.totalMonthly * 12,
    employerMonthly: costs.totalEmployer, employeeMonthly: costs.totalEmployee,
  };
}

export async function getCostReport(db: Db, tenantId: string) {
  const enrollments = await db.collection('cvision_employee_insurances')
    .find({ tenantId, status: 'ACTIVE' }).toArray();

  const empIds = enrollments.map((e) => (e as Record<string, unknown>).employeeId);
  const employees = await db.collection('cvision_employees')
    .find({ tenantId, employeeId: { $in: empIds } })
    .project({ employeeId: 1, department: 1, departmentName: 1 }).toArray();
  const empMap = new Map(employees.map((e) => {
    const rec = e as Record<string, unknown>;
    return [rec.employeeId, rec] as [unknown, Record<string, unknown>];
  }));

  const byDept = new Map<string, { headcount: number; monthlyEmployer: number; monthlyEmployee: number; total: number }>();

  for (const e of enrollments) {
    const rec = e as Record<string, unknown>;
    const emp = empMap.get(rec.employeeId);
    const dept = String(emp?.department || emp?.departmentName || 'Unassigned');
    if (!byDept.has(dept)) byDept.set(dept, { headcount: 0, monthlyEmployer: 0, monthlyEmployee: 0, total: 0 });
    const d = byDept.get(dept)!;
    d.headcount++;
    d.monthlyEmployer += (rec.employerContribution as number) || 0;
    d.monthlyEmployee += (rec.employeeContribution as number) || 0;
    d.total += (rec.monthlyPremium as number) || 0;
  }

  return {
    byDepartment: Array.from(byDept.entries()).map(([dept, d]) => ({ department: dept, ...d })).sort((a, b) => b.total - a.total),
    totalMonthly: enrollments.reduce((s: number, e) => s + ((e as Record<string, unknown>).monthlyPremium as number || 0), 0),
    totalAnnual: enrollments.reduce((s: number, e) => s + ((e as Record<string, unknown>).monthlyPremium as number || 0), 0) * 12,
    enrolledCount: enrollments.length,
  };
}

export async function getClaimsAnalytics(db: Db, tenantId: string) {
  const claims = await db.collection('cvision_insurance_claims').find({ tenantId }).toArray();

  const byType = new Map<string, { count: number; totalAmount: number; avgAmount: number }>();
  const byStatus = new Map<string, number>();

  for (const c of claims) {
    const rec = c as Record<string, unknown>;
    const type = String(rec.type || 'OTHER');
    if (!byType.has(type)) byType.set(type, { count: 0, totalAmount: 0, avgAmount: 0 });
    const t = byType.get(type)!;
    t.count++;
    t.totalAmount += (rec.amount as number) || 0;
    t.avgAmount = Math.round(t.totalAmount / t.count);

    const status = String(rec.status || 'UNKNOWN');
    byStatus.set(status, (byStatus.get(status) || 0) + 1);
  }

  const totalAmount = claims.reduce((s: number, c) => s + ((c as Record<string, unknown>).amount as number || 0), 0);
  const approvedAmount = claims.reduce((s: number, c) => s + ((c as Record<string, unknown>).approvedAmount as number || 0), 0);

  return {
    totalClaims: claims.length,
    totalAmount: Math.round(totalAmount),
    approvedAmount: Math.round(approvedAmount),
    approvalRate: claims.length > 0 ? Math.round((approvedAmount / totalAmount) * 100) : 0,
    byType: Array.from(byType.entries()).map(([type, d]) => ({ type, ...d })),
    byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
  };
}
