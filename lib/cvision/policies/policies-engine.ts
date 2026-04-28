import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export type PolicyCategory = 'HR' | 'IT' | 'SAFETY' | 'FINANCE' | 'OPERATIONS' | 'COMPLIANCE' | 'GENERAL';
export type PolicyStatus = 'DRAFT' | 'ACTIVE' | 'UNDER_REVIEW' | 'ARCHIVED';

export const CATEGORY_LABELS: Record<PolicyCategory, string> = {
  HR: 'Human Resources', IT: 'Information Technology', SAFETY: 'Health & Safety',
  FINANCE: 'Finance', OPERATIONS: 'Operations', COMPLIANCE: 'Compliance', GENERAL: 'General',
};

/* ── Seed Data ─────────────────────────────────────────────────────── */

const SEED_POLICIES = [
  {
    policyId: 'POL-001', title: 'Employee Code of Conduct', titleAr: 'مدونة سلوك الموظفين', category: 'HR' as PolicyCategory,
    content: '# Employee Code of Conduct\n\nAll employees are expected to maintain the highest standards of professional behavior.\n\n## Key Principles\n- Act with integrity and honesty\n- Respect colleagues and clients\n- Protect company assets and confidential information\n- Comply with all applicable laws and regulations\n- Report any violations through proper channels\n\n## Dress Code\nBusiness casual attire is acceptable for most roles. Client-facing roles may require formal dress.\n\n## Communication\nAll business communication should be professional, respectful, and constructive.',
    version: '2.0', mandatory: true, mandatoryFor: 'ALL', status: 'ACTIVE' as PolicyStatus,
    tags: ['conduct', 'behavior', 'ethics'], owner: 'HR Department',
    effectiveDate: new Date('2026-01-01'), reviewDate: new Date('2027-01-01'),
  },
  {
    policyId: 'POL-002', title: 'Leave & Absence Policy', titleAr: 'سياسة الإجازات والغياب', category: 'HR' as PolicyCategory,
    content: '# Leave & Absence Policy\n\n## Annual Leave\n- Full-time employees: 21–30 days per year (based on grade)\n- Must be requested at least 14 days in advance\n- Manager approval required\n\n## Sick Leave\n- Up to 120 days per Saudi Labor Law\n- Medical certificate required after 3 consecutive days\n- First 30 days: full pay; 31–60: 75%; 61–90: unpaid\n\n## Emergency Leave\n- Up to 3 days per occurrence\n- Must notify manager within 24 hours\n\n## Maternity Leave\n- 70 days with full pay\n- Additional 30 days unpaid (optional)',
    version: '3.1', mandatory: true, mandatoryFor: 'ALL', status: 'ACTIVE' as PolicyStatus,
    tags: ['leave', 'absence', 'vacation', 'sick'], owner: 'HR Department',
    effectiveDate: new Date('2026-01-01'), reviewDate: new Date('2026-06-01'),
  },
  {
    policyId: 'POL-003', title: 'Data Privacy & Protection', titleAr: 'حماية البيانات والخصوصية', category: 'IT' as PolicyCategory,
    content: '# Data Privacy & Protection Policy\n\n## Purpose\nProtect personal and sensitive data of employees, clients, and the organization.\n\n## Scope\nApplies to all employees who access, store, or process data.\n\n## Key Rules\n- Never share passwords or access credentials\n- Use company-approved tools for data storage\n- Report data breaches immediately to IT Security\n- Encrypt sensitive data in transit and at rest\n- Clean desk policy for physical documents\n\n## PDPL Compliance\nAll data handling must comply with Saudi Personal Data Protection Law.',
    version: '1.2', mandatory: true, mandatoryFor: 'ALL', status: 'ACTIVE' as PolicyStatus,
    tags: ['privacy', 'data', 'security', 'PDPL'], owner: 'IT Department',
    effectiveDate: new Date('2025-09-01'), reviewDate: new Date('2026-09-01'),
  },
  {
    policyId: 'POL-004', title: 'Workplace Safety', titleAr: 'السلامة في بيئة العمل', category: 'SAFETY' as PolicyCategory,
    content: '# Workplace Safety Policy\n\n## Fire Safety\n- Know your nearest fire exit\n- Participate in all fire drills\n- Never block fire exits or corridors\n\n## Reporting\n- Report all accidents and near-misses immediately\n- Use incident reporting form on the HR portal\n\n## Ergonomics\n- Adjust your workstation to proper height\n- Take regular breaks every 60 minutes\n- Request ergonomic assessment from Facilities',
    version: '1.0', mandatory: true, mandatoryFor: 'ALL', status: 'ACTIVE' as PolicyStatus,
    tags: ['safety', 'fire', 'workplace', 'health'], owner: 'Safety Officer',
    effectiveDate: new Date('2025-06-01'), reviewDate: new Date('2026-06-01'),
  },
  {
    policyId: 'POL-005', title: 'Travel & Expense Policy', titleAr: 'سياسة السفر والمصروفات', category: 'FINANCE' as PolicyCategory,
    content: '# Travel & Expense Policy\n\n## Pre-Approval\n- All business travel must be pre-approved by your manager\n- International travel requires VP approval\n\n## Booking\n- Use the company travel portal for bookings\n- Economy class for domestic; business class for flights > 6 hours (based on grade)\n\n## Per Diem\n- Domestic: 250 SAR/day\n- International: varies by country (see appendix)\n\n## Expense Claims\n- Submit within 14 days of return\n- Original receipts required for amounts > 100 SAR\n- Manager approval required; Finance processes within 5 business days',
    version: '1.5', mandatory: false, mandatoryFor: 'ALL', status: 'ACTIVE' as PolicyStatus,
    tags: ['travel', 'expense', 'reimbursement'], owner: 'Finance Department',
    effectiveDate: new Date('2026-01-01'), reviewDate: new Date('2026-12-01'),
  },
  {
    policyId: 'POL-006', title: 'Remote Work Policy', titleAr: 'سياسة العمل عن بُعد', category: 'HR' as PolicyCategory,
    content: '# Remote Work Policy\n\n## Eligibility\n- Based on role requirements and manager discretion\n- Minimum 6 months in current role\n\n## Guidelines\n- Maximum 2 remote days per week\n- Must be available during core hours (9 AM - 4 PM)\n- Use VPN for all company systems\n- Attend all mandatory in-person meetings\n\n## Equipment\n- Company provides laptop and basic accessories\n- Internet and workspace setup is employee responsibility',
    version: '1.0', mandatory: false, mandatoryFor: 'ALL', status: 'ACTIVE' as PolicyStatus,
    tags: ['remote', 'wfh', 'flexible'], owner: 'HR Department',
    effectiveDate: new Date('2026-02-01'), reviewDate: new Date('2026-08-01'),
  },
];

export async function ensureSeedData(db: Db, tenantId: string): Promise<void> {
  const coll = db.collection('cvision_company_policies');
  const count = await coll.countDocuments({ tenantId });
  if (count > 0) return;

  const now = new Date();
  const docs = SEED_POLICIES.map(p => ({
    ...p, tenantId,
    versions: [{ version: p.version, content: p.content, changedBy: 'SYSTEM', changedAt: now, changeNotes: 'Initial version' }],
    acknowledgments: [
      { employeeId: 'EMP-001', employeeName: 'Ahmed Al-Rashidi', acknowledgedAt: new Date('2026-01-10'), version: p.version },
      { employeeId: 'EMP-002', employeeName: 'Sara Hassan', acknowledgedAt: new Date('2026-01-12'), version: p.version },
    ],
    attachments: [],
    createdAt: now, updatedAt: now,
  }));
  await coll.insertMany(docs);
}

export async function getAcknowledgmentReport(db: Db, tenantId: string) {
  const policies = await db.collection('cvision_company_policies').find({ tenantId, mandatory: true, status: 'ACTIVE' }).toArray();
  const totalEmployees = await db.collection('cvision_employees').countDocuments({ tenantId, status: { $in: ['active', 'ACTIVE', 'probation', 'PROBATION'] } });

  return policies.map(p => {
    const ackCount = (p.acknowledgments || []).filter((a: any) => a.version === p.version).length;
    return {
      policyId: p.policyId, title: p.title, version: p.version,
      totalEmployees, acknowledged: ackCount, pending: totalEmployees - ackCount,
      complianceRate: totalEmployees > 0 ? Math.round((ackCount / totalEmployees) * 100) : 0,
    };
  });
}
