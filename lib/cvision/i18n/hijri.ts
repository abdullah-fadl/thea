/**
 * Hijri ↔ Gregorian Calendar Conversion
 *
 * Pure TypeScript implementation using the Umm al-Qura calendar
 * algorithm — no external dependencies.
 */

/* ── Conversion Core (Kuwaiti algorithm) ───────────────────────────── */

function julianDayToGregorian(jd: number): { year: number; month: number; day: number } {
  const l = jd + 68569;
  const n = Math.floor(4 * l / 146097);
  const ll = l - Math.floor((146097 * n + 3) / 4);
  const i = Math.floor(4000 * (ll + 1) / 1461001);
  const lll = ll - Math.floor(1461 * i / 4) + 31;
  const j = Math.floor(80 * lll / 2447);
  const day = lll - Math.floor(2447 * j / 80);
  const llll = Math.floor(j / 11);
  const month = j + 2 - 12 * llll;
  const year = 100 * (n - 49) + i + llll;
  return { year, month, day };
}

function gregorianToJulianDay(year: number, month: number, day: number): number {
  return Math.floor((1461 * (year + 4800 + Math.floor((month - 14) / 12))) / 4) +
    Math.floor((367 * (month - 2 - 12 * Math.floor((month - 14) / 12))) / 12) -
    Math.floor((3 * Math.floor((year + 4900 + Math.floor((month - 14) / 12)) / 100)) / 4) +
    day - 32075;
}

function julianDayToHijri(jd: number): { year: number; month: number; day: number } {
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const ll = l - 10631 * n + 354;
  const j = Math.floor((10985 - ll) / 5316) * Math.floor((50 * ll) / 17719) +
    Math.floor(ll / 5670) * Math.floor((43 * ll) / 15238);
  const lll = ll - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * lll) / 709);
  const day = lll - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

function hijriToJulianDay(year: number, month: number, day: number): number {
  return Math.floor((11 * year + 3) / 30) + 354 * year + 30 * month -
    Math.floor((month - 1) / 2) + day + 1948440 - 385;
}

/* ── Public API ────────────────────────────────────────────────────── */

const HIJRI_MONTHS_AR = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني',
  'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
  'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];

const HIJRI_MONTHS_EN = [
  'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani',
  'Jumada al-Ula', 'Jumada al-Thani', 'Rajab', 'Shaban',
  'Ramadan', 'Shawwal', 'Dhul Qadah', 'Dhul Hijjah',
];

export interface HijriDate {
  year: number;
  month: number;
  day: number;
  monthNameAr: string;
  monthNameEn: string;
  formattedAr: string;
  formattedEn: string;
}

export function gregorianToHijri(date: Date): HijriDate {
  const jd = gregorianToJulianDay(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const h = julianDayToHijri(jd);
  return {
    year: h.year,
    month: h.month,
    day: h.day,
    monthNameAr: HIJRI_MONTHS_AR[h.month - 1] || '',
    monthNameEn: HIJRI_MONTHS_EN[h.month - 1] || '',
    formattedAr: `${h.day} ${HIJRI_MONTHS_AR[h.month - 1]} ${h.year}هـ`,
    formattedEn: `${h.day} ${HIJRI_MONTHS_EN[h.month - 1]} ${h.year} AH`,
  };
}

export function hijriToGregorian(year: number, month: number, day: number): Date {
  const jd = hijriToJulianDay(year, month, day);
  const g = julianDayToGregorian(jd);
  return new Date(g.year, g.month - 1, g.day);
}

/**
 * Format a date showing both calendars.
 * @example "Feb 21, 2026 — 23 شعبان 1447هـ"
 */
export function formatDualDate(date: Date, locale: 'en' | 'ar' = 'en'): string {
  const hijri = gregorianToHijri(date);
  const gregorian = date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  if (locale === 'ar') {
    return `${hijri.formattedAr} — ${gregorian}`;
  }
  return `${gregorian} — ${hijri.formattedAr}`;
}

/**
 * Get the current Hijri date.
 */
export function currentHijriDate(): HijriDate {
  return gregorianToHijri(new Date());
}

/**
 * Check if a Gregorian date falls within Ramadan.
 */
export function isRamadan(date: Date): boolean {
  return gregorianToHijri(date).month === 9;
}
