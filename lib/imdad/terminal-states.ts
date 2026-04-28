/**
 * Imdad Terminal States
 *
 * Defines which supply-request statuses are considered terminal
 * (no further transitions allowed).
 */

const TERMINAL_STATUSES = new Set([
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'COMPLETED',
  'PO_GENERATED',
  'WORK_ORDER_CREATED',
  'TRANSFER_INITIATED',
  'BUDGET_APPROVED',
]);

/** Returns true if the given status is a terminal workflow state. */
export function isTerminalState(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}
