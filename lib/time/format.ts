const DEFAULT_TIME_ZONE = 'Asia/Riyadh';
const DEFAULT_LOCALE = 'en-GB';

type FormatOptions = {
  timeZone?: string;
  locale?: string;
};

function toDate(value?: string | number | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function formatTime(value?: string | number | Date | null, options: FormatOptions = {}) {
  const date = toDate(value);
  if (!date) return null;
  const locale = options.locale || DEFAULT_LOCALE;
  const timeZone = options.timeZone || DEFAULT_TIME_ZONE;
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatDateTime(value?: string | number | Date | null, options: FormatOptions = {}) {
  const date = toDate(value);
  if (!date) return null;
  const locale = options.locale || DEFAULT_LOCALE;
  const timeZone = options.timeZone || DEFAULT_TIME_ZONE;
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatTimeRange(
  startAt?: string | number | Date | null,
  endAt?: string | number | Date | null,
  timeZone = DEFAULT_TIME_ZONE,
  locale = DEFAULT_LOCALE
) {
  const start = formatTime(startAt, { timeZone, locale });
  if (!start) return '—';
  const end = formatTime(endAt, { timeZone, locale }) || '—';
  return `${start}–${end}`;
}
