export function getIdentityLast4(value: string): string {
  const normalized = String(value || '');
  if (!normalized) return '';
  return normalized.slice(-4);
}
