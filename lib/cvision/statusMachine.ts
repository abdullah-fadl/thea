/**
 * CVision Employee Status Machine
 *
 * Delegates to the comprehensive status-engine for definitions and transitions.
 * This file is kept for backward compatibility — existing imports still work.
 */

import {
  EMPLOYEE_STATUSES as ENGINE_STATUSES,
  STATUS_TRANSITIONS as ENGINE_TRANSITIONS,
  getAllowedTransitions as engineGetAllowedTransitions,
  isTransitionAllowed as engineIsTransitionAllowed,
  isTerminalStatus as engineIsTerminalStatus,
  isValidStatus as engineIsValidStatus,
  getAccessLevel as engineGetAccessLevel,
  type PermissionLevel,
} from './employees/status-engine';

// Re-export engine types and constants
export type { PermissionLevel };
export { ENGINE_STATUSES as EMPLOYEE_STATUS_DEFINITIONS };

// Legacy constant — keys only (uppercase canonical)
export const EMPLOYEE_STATUSES = Object.keys(ENGINE_STATUSES).reduce((acc, key) => {
  acc[key] = key;
  return acc;
}, {} as Record<string, string>);

export type EmployeeStatusType = string;

export function isValidEmployeeStatus(status: string): status is EmployeeStatusType {
  return engineIsValidStatus(status);
}

export const STATUS_TRANSITIONS: Record<string, string[]> = ENGINE_TRANSITIONS;

export function isTransitionAllowed(from: string, to: string): boolean {
  return engineIsTransitionAllowed(from, to);
}

export function getAllowedTransitions(currentStatus: string): string[] {
  return engineGetAllowedTransitions(currentStatus);
}

export function isTerminalStatus(status: string): boolean {
  return engineIsTerminalStatus(status);
}

// =============================================================================
// Access Level (backward-compatible enum)
// =============================================================================

export enum AccessLevel {
  FULL = 'full',
  LIMITED = 'limited',
  RESTRICTED = 'restricted',
  NONE = 'none',
}

const PERM_TO_ACCESS: Record<PermissionLevel, AccessLevel> = {
  FULL: AccessLevel.FULL,
  READ_ONLY: AccessLevel.LIMITED,
  LIMITED: AccessLevel.RESTRICTED,
  NONE: AccessLevel.NONE,
};

export function getAccessLevel(status: string): AccessLevel {
  const perm = engineGetAccessLevel(status);
  return PERM_TO_ACCESS[perm] ?? AccessLevel.NONE;
}

export const STATUS_ACCESS_RULES: Record<string, AccessLevel> = Object.keys(ENGINE_STATUSES).reduce(
  (acc, key) => {
    const perm = ENGINE_STATUSES[key].permissions;
    acc[key] = PERM_TO_ACCESS[perm] ?? AccessLevel.NONE;
    return acc;
  },
  {} as Record<string, AccessLevel>,
);

export function canAccessInternalModules(status: string): boolean {
  const level = getAccessLevel(status);
  return level === AccessLevel.FULL || level === AccessLevel.RESTRICTED;
}

export function canCreateRequests(status: string): boolean {
  return getAccessLevel(status) !== AccessLevel.NONE;
}

export function canViewFinalPayslip(): boolean {
  return true;
}

export function hasRestrictedPrivileges(status: string): boolean {
  return getAccessLevel(status) === AccessLevel.RESTRICTED;
}

// =============================================================================
// Transition Validation
// =============================================================================

export interface TransitionValidationResult {
  allowed: boolean;
  reason?: string;
}

export function validateTransition(
  fromStatus: string,
  toStatus: string,
  effectiveDate?: Date,
): TransitionValidationResult {
  if (fromStatus === toStatus) return { allowed: true };

  if (!isTransitionAllowed(fromStatus, toStatus)) {
    const allowed = getAllowedTransitions(fromStatus);
    return {
      allowed: false,
      reason: `Cannot transition from '${fromStatus}' to '${toStatus}'. Allowed: ${allowed.join(', ') || 'none'}`,
    };
  }

  if (effectiveDate) {
    const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    if (effectiveDate > oneYearFromNow) {
      return { allowed: false, reason: 'Effective date cannot be more than 1 year in the future' };
    }
  }

  return { allowed: true };
}

export function isIdempotentTransition(
  currentStatus: string,
  requestedStatus: string,
  currentEffectiveDate?: Date,
  requestedEffectiveDate?: Date,
): boolean {
  if (currentStatus !== requestedStatus) return false;
  if (currentEffectiveDate && requestedEffectiveDate) {
    const diffMs = Math.abs(currentEffectiveDate.getTime() - requestedEffectiveDate.getTime());
    return diffMs < 24 * 60 * 60 * 1000;
  }
  return true;
}
