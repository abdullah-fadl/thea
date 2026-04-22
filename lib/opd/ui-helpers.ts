type UiLang = 'ar' | 'en';

export function getAge(dob?: string | Date | null) {
  if (!dob) return '—';
  const date = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(date.getTime())) return '—';
  return Math.abs(new Date(Date.now() - date.getTime()).getUTCFullYear() - 1970);
}

export function formatGender(value?: string | null) {
  if (!value) return '—';
  const n = String(value).toUpperCase();
  if (n === 'MALE') return 'M';
  if (n === 'FEMALE') return 'F';
  // UNKNOWN or other: show dash instead of confusing "U"
  return '—';
}

export function getPatientMrn(patient: any) {
  if (!patient) return '';
  const top = String(patient.mrn || patient.fileNumber || '').trim();
  if (top) return top;
  const links = Array.isArray(patient.links) ? patient.links : [];
  const opdLink = links.find((link: any) => link?.system === 'OPD' && (link?.mrn || link?.tempMrn));
  const anyLink = links.find((link: any) => link?.mrn || link?.tempMrn);
  return opdLink?.mrn || opdLink?.tempMrn || anyLink?.mrn || anyLink?.tempMrn || '';
}

export function formatWait(min: number | null | undefined, lang: UiLang = 'ar'): string {
  if (min === null || min === undefined) return '—';
  if (lang === 'en') {
    if (min < 60) return `${min}m`;
    return `${Math.floor(min / 60)}h ${min % 60}m`;
  }
  if (min < 60) return `${min}د`;
  return `${Math.floor(min / 60)}س ${min % 60}د`;
}

export function getWaitColor(min: number | null | undefined): string {
  if (min === null || min === undefined) return 'text-slate-400';
  if (min > 30) return 'text-red-600 font-bold';
  if (min > 15) return 'text-amber-600';
  return 'text-slate-600';
}

export function formatTime(dateStr?: string | null, lang: UiLang = 'ar'): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Riyadh',
  });
}

export function timeAgo(isoStr?: string | null, lang: UiLang = 'ar') {
  if (!isoStr) return '—';
  const mins = Math.floor((Date.now() - new Date(isoStr).getTime()) / 60000);
  if (mins < 1) return lang === 'ar' ? 'الآن' : 'Just now';
  if (mins < 60) return lang === 'ar' ? `${mins}د` : `${mins}m`;
  return lang === 'ar' ? `${Math.floor(mins / 60)}س ${mins % 60}د` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/**
 * Add days to a YYYY-MM-DD date string without timezone shifts.
 * Avoids toISOString() which can shift the date when in UTC+X timezones.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDateLabel(dateStr: string, lang: UiLang = 'ar') {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const yd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterday = `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, '0')}-${String(yd.getDate()).padStart(2, '0')}`;
  if (dateStr === today) return lang === 'ar' ? 'اليوم' : 'Today';
  if (dateStr === yesterday) return lang === 'ar' ? 'أمس' : 'Yesterday';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function parseSystolic(bp?: string | null) {
  if (!bp) return null;
  const systolic = Number(String(bp).split('/')[0]);
  return Number.isNaN(systolic) ? null : systolic;
}
