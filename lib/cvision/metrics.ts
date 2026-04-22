/**
 * CVision Metrics Helpers
 * 
 * Single source of truth for employee counting logic.
 * Ensures consistency across dashboard tiles, manpower summary, and other metrics.
 */

import type { CVisionEmployee } from './types';

/**
 * Check if an employee is considered "active" for counting purposes
 * 
 * Active means:
 * - status === "ACTIVE" (canonical uppercase)
 * - Not archived
 */
export function isActiveEmployee(employee: CVisionEmployee): boolean {
  return (
    employee.status === 'ACTIVE' &&
    !employee.isArchived
  );
}

/**
 * Check if an employee should be counted in manpower metrics
 * 
 * Countable means:
 * - Active (status === "ACTIVE" and not archived)
 * - Has departmentId assigned (required for org structure)
 */
export function isCountableInManpower(employee: CVisionEmployee): boolean {
  return (
    isActiveEmployee(employee) &&
    !!employee.departmentId
  );
}

/**
 * Check if an employee has a position assigned
 */
export function hasPositionAssigned(employee: CVisionEmployee): boolean {
  return !!employee.positionId;
}

/**
 * Get the position key for grouping employees in manpower summary
 * 
 * Returns:
 * - positionId if assigned
 * - "__UNASSIGNED_POSITION__" if no positionId
 */
export function getPositionKey(employee: CVisionEmployee): string {
  return employee.positionId || '__UNASSIGNED_POSITION__';
}
