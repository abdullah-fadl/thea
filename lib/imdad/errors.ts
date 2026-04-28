/**
 * Imdad Workflow Errors
 *
 * Typed error classes for workflow operations.
 * WorkflowErrors provides factory methods for common error scenarios.
 */

export class WorkflowError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, statusCode: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toResponse() {
    return {
      error: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export const WorkflowErrors = {
  REQUEST_NOT_FOUND: () =>
    new WorkflowError('REQUEST_NOT_FOUND', 'Supply request not found', 404),

  NO_APPROVAL_STEP: () =>
    new WorkflowError('NO_APPROVAL_STEP', 'No approval step available at the current position', 400),

  NOT_YOUR_TURN: (userRole: string, expectedRole: string, escalatedTo?: string | null) =>
    new WorkflowError(
      'NOT_YOUR_TURN',
      `Your role (${userRole}) does not match the current approval step (${expectedRole}${escalatedTo ? ` / escalated to ${escalatedTo}` : ''})`,
      403,
      { userRole, expectedRole, escalatedTo },
    ),

  ALREADY_PROCESSED: () =>
    new WorkflowError('ALREADY_PROCESSED', 'This approval step has already been processed by another user', 409),

  TERMINAL_STATE: (status: string) =>
    new WorkflowError('TERMINAL_STATE', `Request is already in terminal state: ${status}`, 400, { status }),

  INVALID_TRANSITION: (from: string, to: string) =>
    new WorkflowError('INVALID_TRANSITION', `Cannot transition from ${from} to ${to}`, 400, { from, to }),
} as const;
