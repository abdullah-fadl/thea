import { formatCurrency } from '@/lib/cvision/i18n/formatters';
import { gregorianToHijri } from '@/lib/cvision/i18n/hijri';

/**
 * Arabic document template renderer.
 *
 * All templates produce RTL HTML suitable for PDF generation
 * (via puppeteer, wkhtmltopdf, or browser print).
 */

/* ── Common Styles ─────────────────────────────────────────────────── */

const COMMON_STYLES = `
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'IBM Plex Sans Arabic', 'Segoe UI', sans-serif; direction: rtl; padding: 40px; color: #1a1a1a; font-size: 14px; line-height: 1.8; }
  .header { text-align: center; margin-bottom: 32px; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; }
  .logo { max-height: 60px; margin-bottom: 8px; }
  .company-name { font-size: 22px; font-weight: 700; }
  .company-name-en { font-size: 14px; color: #555; }
  .ref { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 12px; color: #666; }
  .title { text-align: center; font-size: 20px; font-weight: 700; margin: 24px 0; }
  .content { line-height: 2; font-size: 15px; }
  .content p { margin-bottom: 12px; }
  table.salary { width: 100%; border-collapse: collapse; margin: 16px 0; }
  table.salary td { padding: 8px 12px; border: 1px solid #ddd; }
  table.salary td:first-child { font-weight: 600; background: #f7f7f7; width: 40%; }
  table.salary tr.total td { font-weight: 700; background: #eef; }
  .footer { margin-top: 48px; }
  .signature { margin-top: 60px; }
  .signature .name { font-weight: 700; }
  .qr { position: fixed; bottom: 40px; left: 40px; text-align: center; }
  .qr img { width: 80px; height: 80px; }
  .qr .label { font-size: 9px; color: #888; margin-top: 4px; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg); font-size: 80px; color: rgba(0,0,0,0.03); font-weight: 700; pointer-events: none; }
</style>`;

/* ── Helper ────────────────────────────────────────────────────────── */

function headerBlock(d: LetterData) {
  const hijri = gregorianToHijri(new Date());
  return `
<div class="header">
  ${d.companyLogo ? `<img src="${d.companyLogo}" class="logo" alt="" />` : ''}
  <div class="company-name">${d.companyNameAr || ''}</div>
  <div class="company-name-en">${d.companyName || ''}</div>
  ${d.crNumber ? `<div style="font-size:12px;color:#666">سجل تجاري: ${d.crNumber}</div>` : ''}
</div>
<div class="ref">
  <span>الرقم المرجعي: ${d.letterId || ''}</span>
  <span>التاريخ: ${new Date().toLocaleDateString('ar-SA')} — ${hijri.formattedAr}</span>
</div>`;
}

function signatureBlock(d: LetterData) {
  return `
<div class="footer">
  <div class="signature">
    <div class="name">${d.signerName || ''}</div>
    <div>${d.signerTitle || ''}</div>
    <div>${d.companyNameAr || ''}</div>
  </div>
</div>
${d.qrCodeUrl ? `<div class="qr"><img src="${d.qrCodeUrl}" /><div class="label">للتحقق من صحة الخطاب</div></div>` : ''}`;
}

/* ── Data Types ────────────────────────────────────────────────────── */

interface LetterData {
  companyName?: string;
  companyNameAr?: string;
  companyLogo?: string;
  crNumber?: string;
  letterId?: string;
  signerName?: string;
  signerTitle?: string;
  qrCodeUrl?: string;

  employeeName?: string;
  employeeNameAr?: string;
  employeeId?: string;
  nationalId?: string;
  idTypeAr?: string;
  department?: string;
  departmentAr?: string;
  position?: string;
  positionAr?: string;
  joinDate?: string;
  joinDateAr?: string;

  basicSalary?: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: number;
  totalSalary?: number;

  [key: string]: any;
}

/* ── Template: Salary Certificate (تعريف بالراتب) ──────────────────── */

export function salaryCertificate(d: LetterData): string {
  const total = (d.basicSalary || 0) + (d.housingAllowance || 0) + (d.transportAllowance || 0) + (d.otherAllowances || 0);
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">${COMMON_STYLES}</head><body>
${headerBlock(d)}
<div class="title">تعريف بالراتب</div>
<div class="content">
  <p>إلى من يهمه الأمر،</p>
  <p>نفيد بأن <strong>${d.employeeNameAr || d.employeeName}</strong>،
  يحمل ${d.idTypeAr || 'هوية وطنية'} رقم <strong>${d.nationalId || ''}</strong>،
  يعمل لدى <strong>${d.companyNameAr}</strong> بوظيفة
  <strong>${d.positionAr || d.position}</strong> في قسم <strong>${d.departmentAr || d.department}</strong>
  وذلك اعتباراً من تاريخ <strong>${d.joinDateAr || d.joinDate || ''}</strong>.</p>

  <p>وفيما يلي تفاصيل الراتب الشهري:</p>

  <table class="salary">
    <tr><td>الراتب الأساسي</td><td>${formatCurrency(d.basicSalary || 0, 'ar')}</td></tr>
    <tr><td>بدل السكن</td><td>${formatCurrency(d.housingAllowance || 0, 'ar')}</td></tr>
    <tr><td>بدل النقل</td><td>${formatCurrency(d.transportAllowance || 0, 'ar')}</td></tr>
    <tr><td>بدلات أخرى</td><td>${formatCurrency(d.otherAllowances || 0, 'ar')}</td></tr>
    <tr class="total"><td>إجمالي الراتب</td><td>${formatCurrency(total, 'ar')}</td></tr>
  </table>

  <p>صدر هذا التعريف بناءً على طلب الموظف/الموظفة دون أي مسؤولية على الشركة.</p>
  <p>وتقبلوا فائق الاحترام والتقدير.</p>
</div>
${signatureBlock(d)}
</body></html>`;
}

/* ── Template: Employment Certificate (شهادة عمل) ──────────────────── */

export function employmentCertificate(d: LetterData): string {
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">${COMMON_STYLES}</head><body>
${headerBlock(d)}
<div class="title">شهادة عمل</div>
<div class="content">
  <p>إلى من يهمه الأمر،</p>
  <p>نشهد بأن <strong>${d.employeeNameAr || d.employeeName}</strong>،
  يحمل ${d.idTypeAr || 'هوية وطنية'} رقم <strong>${d.nationalId || ''}</strong>،
  يعمل لدى <strong>${d.companyNameAr}</strong> بوظيفة
  <strong>${d.positionAr || d.position}</strong> في قسم <strong>${d.departmentAr || d.department}</strong>
  منذ تاريخ <strong>${d.joinDateAr || d.joinDate || ''}</strong> وحتى تاريخه.</p>

  <p>أعطيت هذه الشهادة بناءً على طلبه/طلبها دون أدنى مسؤولية على الشركة.</p>
  <p>وتقبلوا فائق الاحترام والتقدير.</p>
</div>
${signatureBlock(d)}
</body></html>`;
}

/* ── Template: Experience Letter (شهادة خبرة) ──────────────────────── */

export function experienceLetter(d: LetterData): string {
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">${COMMON_STYLES}</head><body>
${headerBlock(d)}
<div class="title">شهادة خبرة</div>
<div class="content">
  <p>إلى من يهمه الأمر،</p>
  <p>نشهد بأن <strong>${d.employeeNameAr || d.employeeName}</strong>
  قد عمل لدى <strong>${d.companyNameAr}</strong> بوظيفة
  <strong>${d.positionAr || d.position}</strong> في قسم <strong>${d.departmentAr || d.department}</strong>
  خلال الفترة من <strong>${d.joinDateAr || d.joinDate || ''}</strong>
  إلى <strong>${d.endDateAr || d.endDate || 'تاريخه'}</strong>.</p>

  <p>وقد أثبت خلال فترة عمله كفاءة عالية والتزاماً بالعمل.</p>
  <p>نتمنى له/لها التوفيق والنجاح.</p>
</div>
${signatureBlock(d)}
</body></html>`;
}

/* ── Template: No Objection Certificate (عدم ممانعة) ───────────────── */

export function nocLetter(d: LetterData): string {
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">${COMMON_STYLES}</head><body>
${headerBlock(d)}
<div class="title">خطاب عدم ممانعة</div>
<div class="content">
  <p>إلى من يهمه الأمر،</p>
  <p>لا مانع لدى <strong>${d.companyNameAr}</strong>
  من ${d.nocPurposeAr || 'سفر / نقل كفالة / أي إجراء يخص'}
  الموظف/الموظفة <strong>${d.employeeNameAr || d.employeeName}</strong>،
  يحمل ${d.idTypeAr || 'هوية وطنية'} رقم <strong>${d.nationalId || ''}</strong>.</p>

  <p>علماً بأن هذا الخطاب لا يعد إخلاء طرف ولا يترتب عليه أي التزامات مالية.</p>
</div>
${signatureBlock(d)}
</body></html>`;
}

/* ── Template: Payslip (كشف الراتب) ────────────────────────────────── */

export function payslip(d: LetterData): string {
  const gross = (d.basicSalary || 0) + (d.housingAllowance || 0) + (d.transportAllowance || 0) + (d.otherAllowances || 0) + (d.overtime || 0);
  const deductions = (d.gosiDeduction || 0) + (d.insuranceDeduction || 0) + (d.loanDeduction || 0) + (d.absenceDeduction || 0);
  const net = gross - deductions;

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">${COMMON_STYLES}</head><body>
${headerBlock(d)}
<div class="title">كشف الراتب — ${d.monthAr || d.month || ''} ${d.year || ''}</div>

<table class="salary" style="margin-bottom:24px">
  <tr><td>الاسم</td><td>${d.employeeNameAr || d.employeeName}</td></tr>
  <tr><td>الرقم الوظيفي</td><td>${d.employeeId || ''}</td></tr>
  <tr><td>القسم</td><td>${d.departmentAr || d.department}</td></tr>
  <tr><td>المسمى الوظيفي</td><td>${d.positionAr || d.position}</td></tr>
</table>

<h3 style="margin:12px 0 6px">المستحقات</h3>
<table class="salary">
  <tr><td>الراتب الأساسي</td><td>${formatCurrency(d.basicSalary || 0, 'ar')}</td></tr>
  <tr><td>بدل السكن</td><td>${formatCurrency(d.housingAllowance || 0, 'ar')}</td></tr>
  <tr><td>بدل النقل</td><td>${formatCurrency(d.transportAllowance || 0, 'ar')}</td></tr>
  <tr><td>إضافي / عمل إضافي</td><td>${formatCurrency(d.overtime || 0, 'ar')}</td></tr>
  <tr class="total"><td>إجمالي المستحقات</td><td>${formatCurrency(gross, 'ar')}</td></tr>
</table>

<h3 style="margin:12px 0 6px">الاستقطاعات</h3>
<table class="salary">
  <tr><td>التأمينات الاجتماعية (GOSI)</td><td>${formatCurrency(d.gosiDeduction || 0, 'ar')}</td></tr>
  <tr><td>التأمين الصحي</td><td>${formatCurrency(d.insuranceDeduction || 0, 'ar')}</td></tr>
  <tr><td>سلفة / قرض</td><td>${formatCurrency(d.loanDeduction || 0, 'ar')}</td></tr>
  <tr><td>غياب / خصم</td><td>${formatCurrency(d.absenceDeduction || 0, 'ar')}</td></tr>
  <tr class="total"><td>إجمالي الاستقطاعات</td><td>${formatCurrency(deductions, 'ar')}</td></tr>
</table>

<div style="text-align:center;margin-top:24px;font-size:20px;font-weight:700">
  صافي الراتب: ${formatCurrency(net, 'ar')}
</div>
${signatureBlock(d)}
</body></html>`;
}

/* ── Template Registry ─────────────────────────────────────────────── */

export const ARABIC_TEMPLATES: Record<string, { nameAr: string; nameEn: string; render: (d: LetterData) => string }> = {
  SALARY_CERTIFICATE:      { nameAr: 'تعريف بالراتب', nameEn: 'Salary Certificate', render: salaryCertificate },
  EMPLOYMENT_CERTIFICATE:  { nameAr: 'شهادة عمل', nameEn: 'Employment Certificate', render: employmentCertificate },
  EXPERIENCE_LETTER:       { nameAr: 'شهادة خبرة', nameEn: 'Experience Letter', render: experienceLetter },
  NOC:                     { nameAr: 'عدم ممانعة', nameEn: 'No Objection Certificate', render: nocLetter },
  PAYSLIP:                 { nameAr: 'كشف الراتب', nameEn: 'Payslip', render: payslip },
};

export type TemplateType = keyof typeof ARABIC_TEMPLATES;
