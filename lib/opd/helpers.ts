import type { OPDNursingEntry } from '@/lib/models/OPDEncounter';

function toTimestamp(value: any): number {
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function getLatestAllergies(opdNursingEntries: OPDNursingEntry[] | undefined): string | null {
  if (!Array.isArray(opdNursingEntries) || !opdNursingEntries.length) return null;

  const entries = opdNursingEntries
    .map((entry) => {
      const raw: any = entry?.pfe?.allergies;
      let text = '';
      if (typeof raw === 'string') text = raw.trim();
      else if (Array.isArray(raw)) text = raw.map((a: any) => (typeof a === 'string' ? a : a?.name || a?.substance || '')).filter(Boolean).join(', ');
      else if (raw && typeof raw === 'object' && !(raw instanceof Date)) {
        const obj = raw as { hasNone?: boolean; details?: string | null; substances?: any[]; text?: string };
        if (obj.hasNone === true && !obj.details) return null; // NKDA - no banner needed
        if (obj.details) text = String(obj.details).trim();
        else text = obj.substances?.map?.((s: any) => s?.name || s)?.join?.(', ') || obj.text || '';
      }
      return text ? { text, createdAt: entry?.createdAt } : null;
    })
    .filter(Boolean) as Array<{ text: string; createdAt?: Date | string | null }>;

  if (!entries.length) return null;

  entries.sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
  return entries[0]?.text || null;
}
