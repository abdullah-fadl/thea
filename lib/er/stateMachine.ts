import { ER_STATUSES, type ErStatus } from './constants';
import { ER_TRANSITIONS } from '@/lib/clinical/erTransitions';

export function normalizeErStatus(status: string): ErStatus {
  // Legacy support: treat TRIAGED as TRIAGE_COMPLETED when encountered in existing data.
  return status === 'TRIAGED' ? 'TRIAGE_COMPLETED' : (status as ErStatus);
}

export function statusRank(status: string): number {
  const normalized = normalizeErStatus(status);
  const idx = (ER_STATUSES as readonly string[]).indexOf(normalized);
  return idx === -1 ? -1 : idx;
}

export function canTransitionStatus(current: ErStatus, next: ErStatus): boolean {
  const normalizedCurrent = normalizeErStatus(current);
  if (current === next) {
    return true;
  }
  const allowed = (ER_TRANSITIONS as Record<ErStatus, readonly ErStatus[]>)[normalizedCurrent] || [];
  return allowed.includes(next);
}
