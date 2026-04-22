/**
 * CVision Request Data Generator
 * Bilingual employee request data.
 */

const REQUEST_TYPES = [
  { type: 'SALARY_CERTIFICATE', nameAr: 'شهادة راتب', nameEn: 'Salary Certificate' },
  { type: 'EMPLOYMENT_LETTER', nameAr: 'خطاب تعريف', nameEn: 'Employment Letter' },
  { type: 'EQUIPMENT', nameAr: 'طلب معدات', nameEn: 'Equipment Request' },
  { type: 'TRANSFER', nameAr: 'طلب نقل', nameEn: 'Transfer Request' },
  { type: 'TRAINING', nameAr: 'طلب تدريب', nameEn: 'Training Request' },
  { type: 'EXPENSE_CLAIM', nameAr: 'مطالبة مصروفات', nameEn: 'Expense Claim' },
  { type: 'IT_SUPPORT', nameAr: 'دعم تقني', nameEn: 'IT Support' },
  { type: 'GENERAL', nameAr: 'طلب عام', nameEn: 'General Request' },
] as const;

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;

const DESCRIPTIONS_EN: Record<string, string[]> = {
  SALARY_CERTIFICATE: ['Need salary certificate for bank loan', 'Salary certificate for visa application', 'Certificate for housing loan'],
  EMPLOYMENT_LETTER: ['Employment letter for embassy', 'Letter for visa purposes', 'Proof of employment needed'],
  EQUIPMENT: ['New laptop needed', 'Monitor replacement', 'Office chair replacement', 'Headset for meetings'],
  TRANSFER: ['Transfer to IT department', 'Request branch transfer', 'Department change request'],
  TRAINING: ['Python training course', 'Leadership workshop', 'Project management certification'],
  EXPENSE_CLAIM: ['Business travel expenses', 'Client dinner reimbursement', 'Office supplies purchase'],
  IT_SUPPORT: ['VPN access issue', 'Email not working', 'Software installation needed'],
  GENERAL: ['Parking card request', 'ID badge replacement', 'Office key request'],
};

const DESCRIPTIONS_AR: Record<string, string[]> = {
  SALARY_CERTIFICATE: ['أحتاج شهادة راتب لقرض بنكي', 'شهادة راتب لطلب تأشيرة', 'شهادة لقرض عقاري'],
  EMPLOYMENT_LETTER: ['خطاب تعريف للسفارة', 'خطاب لأغراض التأشيرة', 'إثبات عمل مطلوب'],
  EQUIPMENT: ['أحتاج لابتوب جديد', 'استبدال شاشة', 'استبدال كرسي مكتب', 'سماعات للاجتماعات'],
  TRANSFER: ['نقل لقسم تقنية المعلومات', 'طلب نقل فرع', 'طلب تغيير قسم'],
  TRAINING: ['دورة بايثون', 'ورشة قيادة', 'شهادة إدارة مشاريع'],
  EXPENSE_CLAIM: ['مصاريف سفر عمل', 'تعويض عشاء عملاء', 'شراء لوازم مكتبية'],
  IT_SUPPORT: ['مشكلة في VPN', 'الإيميل لا يعمل', 'تثبيت برنامج مطلوب'],
  GENERAL: ['طلب بطاقة مواقف', 'استبدال بطاقة هوية', 'طلب مفتاح مكتب'],
};

function pick<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface RequestData {
  type: string;
  subject: string;
  subjectAr: string;
  description: string;
  descriptionAr: string;
  priority: string;
}

export class CVisionRequestGenerator {
  generate(): RequestData {
    const reqType = pick(REQUEST_TYPES);
    return {
      type: reqType.type,
      subject: reqType.nameEn,
      subjectAr: reqType.nameAr,
      description: pick(DESCRIPTIONS_EN[reqType.type] || ['General request']),
      descriptionAr: pick(DESCRIPTIONS_AR[reqType.type] || ['طلب عام']),
      priority: pick(PRIORITIES),
    };
  }

  generateN(n: number): RequestData[] {
    return Array.from({ length: n }, () => this.generate());
  }

  /** Generate specifically a salary certificate request */
  generateSalaryCert(): RequestData {
    return {
      type: 'SALARY_CERTIFICATE',
      subject: 'Salary Certificate',
      subjectAr: 'شهادة راتب',
      description: 'Need salary certificate for bank loan application',
      descriptionAr: 'أحتاج شهادة راتب لطلب قرض بنكي',
      priority: 'MEDIUM',
    };
  }
}
