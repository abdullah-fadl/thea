import { gregorianToHijri } from './hijri';

/**
 * Saudi-locale formatting utilities.
 *
 * All functions accept a `locale` parameter ('en' | 'ar')
 * and use Intl APIs for proper formatting.
 */

/* ── Currency ──────────────────────────────────────────────────────── */

export function formatCurrency(amount: number, locale: 'en' | 'ar' = 'en'): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
  }).format(amount);
}

/* ── Number ────────────────────────────────────────────────────────── */

export function formatNumber(num: number, locale: 'en' | 'ar' = 'en'): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US').format(num);
}

/* ── Percentage ────────────────────────────────────────────────────── */

export function formatPercentage(value: number, locale: 'en' | 'ar' = 'en'): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

/* ── Saudi Phone ───────────────────────────────────────────────────── */

export function formatSaudiPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('966')) {
    return `+966 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  if (digits.length === 10 && digits.startsWith('05')) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return phone;
}

/* ── National ID ───────────────────────────────────────────────────── */

export function formatNationalId(id: string): string {
  if (id.length === 10) {
    return `${id.slice(0, 1)}-${id.slice(1, 5)}-${id.slice(5)}`;
  }
  return id;
}

/* ── IBAN ──────────────────────────────────────────────────────────── */

export function formatIBAN(iban: string): string {
  const clean = iban.replace(/\s/g, '');
  return clean.replace(/(.{4})/g, '$1 ').trim();
}

/* ── Date ──────────────────────────────────────────────────────────── */

export function formatDate(date: Date | string, locale: 'en' | 'ar' = 'en', includeHijri = false): string {
  const d = new Date(date);
  const formatted = d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  if (includeHijri) {
    const hijri = gregorianToHijri(d);
    return `${formatted} (${hijri.formattedAr})`;
  }
  return formatted;
}

/* ── Date + Time ───────────────────────────────────────────────────── */

export function formatDateTime(date: Date | string, locale: 'en' | 'ar' = 'en'): string {
  const d = new Date(date);
  return d.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/* ── Relative Time ─────────────────────────────────────────────────── */

export function formatRelativeTime(date: Date | string, locale: 'en' | 'ar' = 'en'): string {
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
  const diffMs = Date.now() - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffSec < 60) return rtf.format(-diffSec, 'second');
  if (diffMin < 60) return rtf.format(-diffMin, 'minute');
  if (diffHour < 24) return rtf.format(-diffHour, 'hour');
  if (diffDay < 30) return rtf.format(-diffDay, 'day');
  if (diffDay < 365) return rtf.format(-Math.floor(diffDay / 30), 'month');
  return rtf.format(-Math.floor(diffDay / 365), 'year');
}

/* ── File Size ─────────────────────────────────────────────────────── */

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/* ── Duration ──────────────────────────────────────────────────────── */

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/* ── Salary Breakdown (Arabic) ─────────────────────────────────────── */

export function formatSalaryBreakdownAr(data: {
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  gosiDeduction: number;
  otherDeductions: number;
}) {
  const gross = data.basicSalary + data.housingAllowance + data.transportAllowance + data.otherAllowances;
  const totalDeductions = data.gosiDeduction + data.otherDeductions;
  const net = gross - totalDeductions;

  return {
    earnings: [
      { labelAr: 'الراتب الأساسي', labelEn: 'Basic Salary', amount: data.basicSalary },
      { labelAr: 'بدل السكن', labelEn: 'Housing Allowance', amount: data.housingAllowance },
      { labelAr: 'بدل النقل', labelEn: 'Transport Allowance', amount: data.transportAllowance },
      { labelAr: 'بدلات أخرى', labelEn: 'Other Allowances', amount: data.otherAllowances },
    ],
    deductions: [
      { labelAr: 'التأمينات الاجتماعية', labelEn: 'GOSI', amount: data.gosiDeduction },
      { labelAr: 'استقطاعات أخرى', labelEn: 'Other Deductions', amount: data.otherDeductions },
    ],
    grossAr: `إجمالي المستحقات: ${formatCurrency(gross, 'ar')}`,
    grossEn: `Total Earnings: ${formatCurrency(gross, 'en')}`,
    netAr: `صافي الراتب: ${formatCurrency(net, 'ar')}`,
    netEn: `Net Salary: ${formatCurrency(net, 'en')}`,
    gross,
    net,
    totalDeductions,
  };
}
