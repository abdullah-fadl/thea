/**
 * Hijri (Islamic / Umm al-Qura) Date Utilities
 *
 * Pure TypeScript implementation of the tabular Islamic calendar conversion.
 * Uses the arithmetic approximation (30-year cycle with 11 leap years).
 * Accuracy: +/- 1 day, which is standard for computational / EHR use.
 *
 * No external dependencies required.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HijriDate {
  year: number;  // e.g. 1446
  month: number; // 1-12
  day: number;   // 1-30
}

export interface FormattedDates {
  /** ISO-style Gregorian: "2025-03-02" */
  gregorian: string;
  /** ISO-style Hijri: "1446-09-02" */
  hijri: string;
  /** Localized Gregorian: "March 2, 2025" or "2 مارس 2025" */
  gregorianDisplay: string;
  /** Localized Hijri: "2 Ramadan 1446" or "٢ رمضان ١٤٤٦" */
  hijriDisplay: string;
  /** Combined dual: "2 Ramadan 1446 / March 2, 2025" */
  combined: string;
}

// ---------------------------------------------------------------------------
// Month name data
// ---------------------------------------------------------------------------

const HIJRI_MONTHS_AR = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الثاني',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
] as const;

const HIJRI_MONTHS_EN = [
  'Muharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi al-Thani',
  'Jumada al-Ula',
  'Jumada al-Akhirah',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  'Dhu al-Qi\'dah',
  'Dhu al-Hijjah',
] as const;

const GREGORIAN_MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
] as const;

const GREGORIAN_MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

// ---------------------------------------------------------------------------
// Arabic numeral mapping
// ---------------------------------------------------------------------------

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;

/**
 * Convert a western number to Eastern Arabic-Indic numerals.
 * Example: 1446 -> "١٤٤٦"
 */
export function toArabicNumerals(num: number): string {
  return String(num)
    .split('')
    .map((ch) => {
      const d = parseInt(ch, 10);
      return isNaN(d) ? ch : ARABIC_DIGITS[d];
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Tabular Islamic calendar algorithm
// ---------------------------------------------------------------------------

/**
 * Leap years in the 30-year cycle.
 * A Hijri year Y is a leap year if (Y % 30) is one of these values.
 */
const LEAP_YEARS_IN_CYCLE = new Set([2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29]);

function isHijriLeapYear(year: number): boolean {
  const mod = ((year % 30) + 30) % 30;
  return LEAP_YEARS_IN_CYCLE.has(mod);
}

/** Number of days in a given Hijri month (1-based). */
function hijriMonthDays(year: number, month: number): number {
  // Odd months (1,3,5,7,9,11) have 30 days; even months have 29.
  // Exception: month 12 in a leap year has 30 days.
  if (month < 1 || month > 12) return 0;
  if (month % 2 === 1) return 30;
  if (month === 12 && isHijriLeapYear(year)) return 30;
  return 29;
}

/** Total days in a Hijri year. */
function hijriYearDays(year: number): number {
  return isHijriLeapYear(year) ? 355 : 354;
}

/**
 * Hijri epoch expressed as Julian Day Number (JDN).
 *
 * The Islamic calendar epoch is 1 Muharram 1 AH which corresponds to
 * July 19, 622 CE (proleptic Gregorian) / July 16, 622 CE (Julian).
 *
 * JDN of the epoch = 1,948,439.5 (astronomical), we use the integer
 * form for day-level calculations: 1,948,440.
 */
const HIJRI_EPOCH_JDN = 1948440;

// ---------------------------------------------------------------------------
// Julian Day Number conversions (Gregorian <-> JDN)
// ---------------------------------------------------------------------------

/** Convert a Gregorian date to Julian Day Number. */
function gregorianToJDN(year: number, month: number, day: number): number {
  // Algorithm from Meeus, "Astronomical Algorithms"
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/** Convert Julian Day Number to Gregorian date components. */
function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor(146097 * b / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor(1461 * d / 4);
  const m = Math.floor((5 * e + 2) / 153);

  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);

  return { year, month, day };
}

// ---------------------------------------------------------------------------
// Hijri <-> JDN conversions
// ---------------------------------------------------------------------------

/** Convert a Hijri date to Julian Day Number. */
function hijriToJDN(year: number, month: number, day: number): number {
  // Count complete 30-year cycles
  const cycles = Math.floor((year - 1) / 30);
  const remainder = (year - 1) % 30;

  // Each 30-year cycle has exactly 10631 days
  let jdn = HIJRI_EPOCH_JDN + cycles * 10631;

  // Add remaining complete years
  for (let y = 1; y <= remainder; y++) {
    jdn += hijriYearDays(y);
  }

  // Add complete months in current year
  for (let m = 1; m < month; m++) {
    jdn += hijriMonthDays(year, m);
  }

  // Add days
  jdn += day - 1;

  return jdn;
}

/** Convert Julian Day Number to Hijri date. */
function jdnToHijri(jdn: number): HijriDate {
  // Days since Hijri epoch
  let remaining = jdn - HIJRI_EPOCH_JDN;

  // Determine the 30-year cycle
  const cycles = Math.floor(remaining / 10631);
  remaining = remaining % 10631;

  let year = cycles * 30 + 1;

  // Walk years within the cycle
  while (remaining >= hijriYearDays(year)) {
    remaining -= hijriYearDays(year);
    year++;
  }

  // Walk months
  let month = 1;
  while (month < 12 && remaining >= hijriMonthDays(year, month)) {
    remaining -= hijriMonthDays(year, month);
    month++;
  }

  const day = remaining + 1;

  return { year, month, day };
}

// ---------------------------------------------------------------------------
// Public API: conversions
// ---------------------------------------------------------------------------

/**
 * Convert a Gregorian `Date` object to a Hijri date.
 */
export function gregorianToHijri(date: Date): HijriDate {
  const jdn = gregorianToJDN(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
  return jdnToHijri(jdn);
}

/**
 * Convert a Hijri date to a Gregorian `Date` object.
 */
export function hijriToGregorian(hijri: HijriDate): Date {
  const jdn = hijriToJDN(hijri.year, hijri.month, hijri.day);
  const g = jdnToGregorian(jdn);
  return new Date(g.year, g.month - 1, g.day);
}

// ---------------------------------------------------------------------------
// Public API: formatting helpers
// ---------------------------------------------------------------------------

/**
 * Get the Hijri month name in the requested language.
 * @param month 1-12
 */
export function getHijriMonthName(month: number, language: 'ar' | 'en'): string {
  const idx = month - 1;
  if (idx < 0 || idx > 11) return '';
  return language === 'ar' ? HIJRI_MONTHS_AR[idx] : HIJRI_MONTHS_EN[idx];
}

/**
 * Get current Hijri year (or for a given date).
 */
export function getHijriYear(date?: Date): number {
  const d = date || new Date();
  return gregorianToHijri(d).year;
}

/**
 * Check if the given date (or today) falls in Ramadan.
 * Useful for fasting-related clinical notes.
 */
export function isRamadan(date?: Date): boolean {
  const d = date || new Date();
  return gregorianToHijri(d).month === 9;
}

/**
 * Format a date as a Hijri string.
 * AR: "٢ رمضان ١٤٤٦"
 * EN: "2 Ramadan 1446"
 */
export function formatHijriDate(date: Date, language: 'ar' | 'en'): string {
  const h = gregorianToHijri(date);
  const monthName = getHijriMonthName(h.month, language);
  if (language === 'ar') {
    return `${toArabicNumerals(h.day)} ${monthName} ${toArabicNumerals(h.year)}`;
  }
  return `${h.day} ${monthName} ${h.year}`;
}

/**
 * Format a date as a dual Hijri / Gregorian string.
 * AR: "٢ رمضان ١٤٤٦ هـ / ٢ مارس ٢٠٢٥ م"
 * EN: "2 Ramadan 1446 H / March 2, 2025"
 */
export function formatDualDate(date: Date, language: 'ar' | 'en'): string {
  const hijriStr = formatHijriDate(date, language);
  const gMonth = language === 'ar'
    ? GREGORIAN_MONTHS_AR[date.getMonth()]
    : GREGORIAN_MONTHS_EN[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  if (language === 'ar') {
    return `${hijriStr} هـ / ${toArabicNumerals(day)} ${gMonth} ${toArabicNumerals(year)} م`;
  }
  return `${hijriStr} H / ${gMonth} ${day}, ${year}`;
}

/**
 * Get all formatted representations of a date.
 */
export function getFormattedDates(date: Date, language: 'ar' | 'en'): FormattedDates {
  const h = gregorianToHijri(date);
  const pad = (n: number) => String(n).padStart(2, '0');

  const gregorian = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const hijri = `${h.year}-${pad(h.month)}-${pad(h.day)}`;

  // Display strings
  const gMonth = language === 'ar'
    ? GREGORIAN_MONTHS_AR[date.getMonth()]
    : GREGORIAN_MONTHS_EN[date.getMonth()];

  const gregorianDisplay = language === 'ar'
    ? `${toArabicNumerals(date.getDate())} ${gMonth} ${toArabicNumerals(date.getFullYear())}`
    : `${gMonth} ${date.getDate()}, ${date.getFullYear()}`;

  const hijriDisplay = formatHijriDate(date, language);

  const combined = formatDualDate(date, language);

  return { gregorian, hijri, gregorianDisplay, hijriDisplay, combined };
}

// ---------------------------------------------------------------------------
// Main display helper
// ---------------------------------------------------------------------------

/**
 * Universal date display function for the entire app.
 *
 * Handles `Date`, ISO date string, or `null` / `undefined`.
 * Returns an empty string for invalid / missing input.
 *
 * @param date      Date value to format
 * @param language  'ar' | 'en'
 * @param options   { hijriOnly?, gregorianOnly?, dual? }
 *                  Default: dual
 */
export function formatDateForDisplay(
  date: Date | string | null | undefined,
  language: 'ar' | 'en',
  options?: { hijriOnly?: boolean; gregorianOnly?: boolean; dual?: boolean },
): string {
  if (!date) return '';

  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else {
    d = new Date(date);
  }

  // Guard against invalid dates
  if (isNaN(d.getTime())) return '';

  const { hijriOnly = false, gregorianOnly = false } = options || {};

  if (hijriOnly) {
    return formatHijriDate(d, language);
  }

  if (gregorianOnly) {
    const gMonth = language === 'ar'
      ? GREGORIAN_MONTHS_AR[d.getMonth()]
      : GREGORIAN_MONTHS_EN[d.getMonth()];
    return language === 'ar'
      ? `${toArabicNumerals(d.getDate())} ${gMonth} ${toArabicNumerals(d.getFullYear())}`
      : `${gMonth} ${d.getDate()}, ${d.getFullYear()}`;
  }

  // Default: dual
  return formatDualDate(d, language);
}
