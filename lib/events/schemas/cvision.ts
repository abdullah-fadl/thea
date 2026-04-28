/**
 * Phase 7.5 — CVision (HR / payroll) domain event schemas
 *
 * Three high-value HR-platform events. Importing this module triggers
 * registerEventType() side-effects at module-load time, so the boot-time
 * barrel at `lib/events/schemas/index.ts` must be imported once at app
 * boot before any route attempts to emit.
 *
 * PII discipline: every payload below is restricted to opaque IDs (UUIDs),
 * tenant scope (tenantId), status enums, period codes, and timestamps. No
 * names, no national IDs, no salary amounts, no contact info, no termination
 * reasons. Downstream consumers re-read the employee / payroll-run row by
 * ID through tenant-scoped Prisma / Mongo queries — not through the event
 * payload — so PII stays inside the row-level access boundary that already
 * governs reads.
 */

import { z } from 'zod';
import { registerEventType } from '../registry';

// ─── 1. employee.hired@v1 ───────────────────────────────────────────────────
// Fired after a new CVision employee row is inserted (POST /api/cvision/employees)
// AND the lifecycle hook has been kicked off (onboarding, leave balances,
// compensation seed). The event represents "an employment relationship is now
// live for this tenant" — downstream consumers may pre-warm directories,
// HRIS-export queues, or recommend onboarding agents.
registerEventType({
  eventName: 'employee.hired',
  version: 1,
  aggregate: 'employee',
  description:
    'A new CVision employee was created and lifecycle initialisation was kicked off.',
  payloadSchema: z.object({
    employeeId: z.string().uuid(),
    tenantId: z.string().uuid(),
    departmentId: z.string().uuid().nullable(),
    jobTitleId: z.string().uuid().nullable(),
    status: z.enum([
      'ACTIVE',
      'PROBATION',
      'ON_ANNUAL_LEAVE',
      'ON_SICK_LEAVE',
      'ON_MATERNITY_LEAVE',
      'ON_UNPAID_LEAVE',
      'SUSPENDED',
      'SUSPENDED_WITHOUT_PAY',
      'NOTICE_PERIOD',
      'RESIGNED',
      'TERMINATED',
      'END_OF_CONTRACT',
      'RETIRED',
      'DECEASED',
    ]),
    hiredAt: z.string().datetime(),
  }),
});

// ─── 2. employee.terminated@v1 ──────────────────────────────────────────────
// Fired when an employee status row transitions to RESIGNED or TERMINATED
// inside POST /api/cvision/employees/[id]/status. `reason` and free-text
// notes are deliberately excluded — they routinely contain PII and grievance
// content that must not appear in event rows.
registerEventType({
  eventName: 'employee.terminated',
  version: 1,
  aggregate: 'employee',
  description:
    'A CVision employee transitioned to a terminal employment status (RESIGNED or TERMINATED).',
  payloadSchema: z.object({
    employeeId: z.string().uuid(),
    tenantId: z.string().uuid(),
    fromStatus: z.string().min(1),
    toStatus: z.enum(['RESIGNED', 'TERMINATED']),
    effectiveAt: z.string().datetime(),
  }),
});

// ─── 3. payroll.run.completed@v1 ────────────────────────────────────────────
// Fired when a payroll run transitions DRY_RUN → APPROVED inside
// POST /api/cvision/payroll/runs/[id]/approve. Approval is the point at which
// the dry-run snapshot is locked and the run becomes immutable; subsequent
// "mark-paid" is a payment-out signal, not the run-level finalisation.
//
// Salary totals, gross/net amounts, and per-employee deductions are NEVER
// emitted — those live behind payroll-permission RLS. We only carry the
// run identity, tenant scope, period code (e.g. "2026-04"), the new status,
// and the count of payslips covered (an operational, non-sensitive aggregate).
registerEventType({
  eventName: 'payroll.run.completed',
  version: 1,
  aggregate: 'payroll_run',
  description:
    'A CVision payroll run was finalised (status transitioned DRY_RUN → APPROVED).',
  payloadSchema: z.object({
    runId: z.string().uuid(),
    tenantId: z.string().uuid(),
    period: z.string().min(1),
    status: z.literal('APPROVED'),
    payslipCount: z.number().int().nonnegative(),
    finalizedAt: z.string().datetime(),
  }),
});
