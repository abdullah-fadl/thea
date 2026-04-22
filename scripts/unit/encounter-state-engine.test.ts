import { ER_STATUSES } from '@/lib/er/constants';
import { validateDisposition } from '@/lib/er/disposition';
import { validateTriageCompletionInput } from '@/lib/er/triage';
import { validateErEncounterTransition } from '@/lib/clinical/encounterStateEngine';
import { getFinalStatusBlock } from '@/lib/er/finalStatusGuard';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function getErrorStatus(result: ReturnType<typeof validateErEncounterTransition>): number {
  if (result.ok) {
    throw new Error('Expected failure but got ok result');
  }
  return result.error.status;
}

function getErrorBody(result: ReturnType<typeof validateErEncounterTransition>): any {
  if (result.ok) {
    throw new Error('Expected failure but got ok result');
  }
  return result.error.body;
}

// 1) Invalid transition returns 400.
const invalidTransition = validateErEncounterTransition({
  encounter: { status: 'ARRIVED' },
  nextStatus: 'DECISION',
  statusOrder: ER_STATUSES,
  validateDisposition,
  validateTriageCompletionInput,
});
assert(getErrorStatus(invalidTransition) === 400, 'Invalid transition should return 400');

// Idempotency: same status should be allowed (route handles no-op).
const idempotent = validateErEncounterTransition({
  encounter: { status: 'TRIAGE_IN_PROGRESS' },
  nextStatus: 'TRIAGE_IN_PROGRESS',
  statusOrder: ER_STATUSES,
  validateDisposition,
  validateTriageCompletionInput,
});
assert(idempotent.ok, 'Same-status transition should be allowed');

// 2) TRIAGE_COMPLETED requires chiefComplaint + vitals + triageLevel.
const triageIncomplete = validateErEncounterTransition({
  encounter: { status: 'REGISTERED', chiefComplaint: '', triageLevel: null },
  nextStatus: 'TRIAGE_COMPLETED',
  statusOrder: ER_STATUSES,
  triageDoc: { vitals: { HR: null, RR: null, TEMP: null, SPO2: null, systolic: null, diastolic: null } },
  validateDisposition,
  validateTriageCompletionInput,
});
const triageBody = getErrorBody(triageIncomplete);
assert(getErrorStatus(triageIncomplete) === 409, 'Triage incomplete should return 409');
assert(Array.isArray(triageBody.missing), 'Triage incomplete should include missing list');
assert(triageBody.missing.includes('chiefComplaint'), 'Missing chiefComplaint should be reported');
assert(triageBody.missing.includes('systolic'), 'Missing systolic should be reported');
assert(triageBody.missing.includes('triageLevel'), 'Missing triageLevel should be reported');

// Final status lock: cannot transition away from a final status.
const finalLock = validateErEncounterTransition({
  encounter: { status: 'DISCHARGED' },
  nextStatus: 'SEEN_BY_DOCTOR',
  statusOrder: ER_STATUSES,
  validateDisposition,
  validateTriageCompletionInput,
});
assert(getErrorStatus(finalLock) === 400, 'Final status should block further transitions');

const finalTriageBlock = getFinalStatusBlock('DISCHARGED', 'triage.save');
assert(finalTriageBlock?.status === 409, 'Post-final triage mutation should return 409');

// 3) Finalization requires complete disposition and matching type.
const finalizeMissingDisposition = validateErEncounterTransition({
  encounter: { status: 'DECISION' },
  nextStatus: 'DISCHARGED',
  statusOrder: ER_STATUSES,
  dispositionDoc: null,
  validateDisposition,
  validateTriageCompletionInput,
});
assert(getErrorStatus(finalizeMissingDisposition) === 409, 'Finalize without disposition should return 409');

const finalizeMismatchType = validateErEncounterTransition({
  encounter: { status: 'DECISION' },
  nextStatus: 'DISCHARGED',
  statusOrder: ER_STATUSES,
  dispositionDoc: {
    type: 'ADMIT',
    admitService: 'Medicine',
    admitWardUnit: 'Ward A',
    reasonForAdmission: 'Observation',
    handoffSbar: 'SBAR',
  },
  validateDisposition,
  validateTriageCompletionInput,
});
const mismatchBody = getErrorBody(finalizeMismatchType);
assert(getErrorStatus(finalizeMismatchType) === 409, 'Disposition mismatch should return 409');
assert(mismatchBody.error === 'Disposition type mismatch', 'Mismatch should report type error');
