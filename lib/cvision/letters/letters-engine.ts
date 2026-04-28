import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export type LetterType = 'SALARY_CERTIFICATE' | 'EMPLOYMENT_CERTIFICATE' | 'EXPERIENCE_LETTER' | 'NOC' | 'WARNING_LETTER' | 'TERMINATION_LETTER' | 'PROMOTION_LETTER' | 'TRANSFER_LETTER' | 'VISA_SUPPORT' | 'BANK_LETTER' | 'EMBASSY_LETTER' | 'TO_WHOM_IT_MAY_CONCERN' | 'CUSTOM';
export type LetterStatus = 'REQUESTED' | 'GENERATING' | 'PENDING_APPROVAL' | 'APPROVED' | 'ISSUED' | 'REJECTED';

export const TYPE_LABELS: Record<LetterType, string> = {
  SALARY_CERTIFICATE: 'Salary Certificate', EMPLOYMENT_CERTIFICATE: 'Employment Certificate',
  EXPERIENCE_LETTER: 'Experience Letter', NOC: 'No Objection Certificate',
  WARNING_LETTER: 'Warning Letter', TERMINATION_LETTER: 'Termination Letter',
  PROMOTION_LETTER: 'Promotion Letter', TRANSFER_LETTER: 'Transfer Letter',
  VISA_SUPPORT: 'Visa Support Letter', BANK_LETTER: 'Bank Letter',
  EMBASSY_LETTER: 'Embassy Letter', TO_WHOM_IT_MAY_CONCERN: 'To Whom It May Concern',
  CUSTOM: 'Custom Letter',
};

export const SELF_SERVICE_TYPES: LetterType[] = [
  'SALARY_CERTIFICATE', 'EMPLOYMENT_CERTIFICATE', 'NOC', 'VISA_SUPPORT', 'BANK_LETTER', 'TO_WHOM_IT_MAY_CONCERN',
];

function genVerificationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/* ── Templates ─────────────────────────────────────────────────────── */

const TEMPLATE_SALARY_CERT = `Date: {{currentDate}}

To Whom It May Concern,

This is to certify that {{employeeName}}, holding {{idType}} No. {{nationalId}}, is employed at {{companyName}} as {{position}} in the {{department}} department since {{joinDate}}.

Monthly salary details:
- Basic Salary: {{basicSalary}} SAR
- Housing Allowance: {{housingAllowance}} SAR
- Transport Allowance: {{transportAllowance}} SAR
- Other Allowances: {{otherAllowances}} SAR
- Total Salary: {{totalSalary}} SAR

This letter is issued upon the employee's request without any responsibility on the company.`;

const TEMPLATE_EMPLOYMENT_CERT = `Date: {{currentDate}}

To Whom It May Concern,

This is to certify that {{employeeName}}, holding {{idType}} No. {{nationalId}}, is currently employed at {{companyName}} as {{position}} in the {{department}} department since {{joinDate}}.

He/She is a full-time employee and is in good standing with the organization.

This letter is issued upon the employee's request.`;

const TEMPLATE_NOC = `Date: {{currentDate}}

To Whom It May Concern,

We hereby confirm that {{companyName}} has no objection to {{employeeName}}, {{idType}} No. {{nationalId}}, who is currently employed as {{position}}, to {{purpose}}.

This No Objection Certificate is valid for a period of 30 days from the date of issue.`;

export const TEMPLATES: Record<string, string> = {
  SALARY_CERTIFICATE: TEMPLATE_SALARY_CERT,
  EMPLOYMENT_CERTIFICATE: TEMPLATE_EMPLOYMENT_CERT,
  NOC: TEMPLATE_NOC,
};

export function fillTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] !== undefined ? String(data[key]) : `{{${key}}}`);
}

export async function generateLetterContent(db: Db, tenantId: string, employeeId: string, type: LetterType, extraData?: Record<string, any>): Promise<{ body: string; templateData: Record<string, any> }> {
  const emp = await db.collection('cvision_employees').findOne({ tenantId, id: employeeId });
  const comp = await db.collection('cvision_employee_compensation').findOne({ tenantId, employeeId });

  const data: Record<string, any> = {
    currentDate: new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }),
    employeeName: emp?.fullName || employeeId,
    nationalId: emp?.nationalId || 'N/A',
    idType: emp?.nationality === 'Saudi' ? 'National ID' : 'Iqama',
    companyName: 'The Company',
    position: emp?.position || emp?.jobTitle || 'Employee',
    department: emp?.department || 'N/A',
    joinDate: (emp?.hiredAt || emp?.hireDate) ? new Date(emp.hiredAt || emp.hireDate).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A',
    basicSalary: comp?.basicSalary || 0,
    housingAllowance: comp?.allowances?.housing || 0,
    transportAllowance: comp?.allowances?.transport || 0,
    otherAllowances: (comp?.allowances?.phone || 0) + (comp?.allowances?.food || 0) + (comp?.allowances?.education || 0) + (comp?.allowances?.remote || 0),
    totalSalary: comp?.grossSalary || 0,
    ...extraData,
  };

  const template = TEMPLATES[type] || TEMPLATES.EMPLOYMENT_CERTIFICATE || '{{employeeName}} — {{type}} letter content.';
  return { body: fillTemplate(template, data), templateData: data };
}

/* ── Seed Data ─────────────────────────────────────────────────────── */

export async function ensureSeedData(db: Db, tenantId: string): Promise<void> {
  const coll = db.collection('cvision_letters');
  const count = await coll.countDocuments({ tenantId });
  if (count > 0) return;

  const now = new Date();
  const seeds = [
    { letterId: 'LTR-2026-00001', employeeId: 'EMP-001', employeeName: 'Ahmed Al-Rashidi', type: 'SALARY_CERTIFICATE', language: 'EN', subject: 'Salary Certificate — Ahmed Al-Rashidi', body: 'Auto-generated salary certificate...', status: 'ISSUED', verificationCode: genVerificationCode(), requestedBy: 'EMP-001', downloadCount: 2, printCount: 1, createdAt: new Date('2026-01-15'), issuedAt: new Date('2026-01-16') },
    { letterId: 'LTR-2026-00002', employeeId: 'EMP-002', employeeName: 'Sara Hassan', type: 'EMPLOYMENT_CERTIFICATE', language: 'EN', subject: 'Employment Certificate — Sara Hassan', body: 'Auto-generated employment certificate...', status: 'ISSUED', verificationCode: genVerificationCode(), requestedBy: 'EMP-002', downloadCount: 1, printCount: 0, createdAt: new Date('2026-02-01'), issuedAt: new Date('2026-02-02') },
    { letterId: 'LTR-2026-00003', employeeId: 'EMP-003', employeeName: 'Mohammed Al-Harbi', type: 'NOC', language: 'EN', subject: 'NOC — Mohammed Al-Harbi', body: 'Auto-generated NOC...', status: 'PENDING_APPROVAL', verificationCode: genVerificationCode(), requestedBy: 'EMP-003', downloadCount: 0, printCount: 0, createdAt: new Date('2026-02-18') },
  ];

  await coll.insertMany(seeds.map(s => ({
    ...s, tenantId, templateData: {}, qrCodeUrl: `https://verify.company.com/${s.verificationCode}`, updatedAt: now,
  })));
}
