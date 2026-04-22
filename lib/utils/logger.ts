/**
 * Re-exports from the centralized structured logger.
 * @see lib/monitoring/logger.ts — the canonical logger for the project.
 */
export { logger } from '@/lib/monitoring/logger';

/** Mask a sensitive value, keeping only the last `visible` characters. */
export function maskValue(value: string | number | null | undefined, visible = 4): string {
  if (value === null || value === undefined) return '***';
  const str = String(value);
  if (str.length <= visible) return '***';
  return `***${str.slice(-visible)}`;
}
