import { createHash } from 'crypto';

function normalizeValue(value: string): string {
  return String(value || '').trim();
}

export function sha256(value: string): string {
  const normalized = normalizeValue(value);
  return createHash('sha256').update(normalized).digest('hex');
}

export function last4(value: string): string {
  const normalized = normalizeValue(value);
  if (!normalized) return '';
  const trimmed = normalized.replace(/\s+/g, '');
  return trimmed.length <= 4 ? trimmed : trimmed.slice(-4);
}
