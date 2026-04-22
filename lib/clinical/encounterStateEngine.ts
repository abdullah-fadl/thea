import { ER_TRANSITIONS } from '@/lib/clinical/erTransitions';

const FINAL_STATUSES = ['DISCHARGED', 'ADMITTED', 'TRANSFERRED', 'DEATH', 'CANCELLED'] as const;

export type EncounterTransitionError = {
  status: number;
  body: {
    error: string;
    missing?: string[];
    expectedType?: string;
    currentType?: string | null;
    from?: string;
    to?: string;
  };
};

export type EncounterTransitionResult = { ok: true } | { ok: false; error: EncounterTransitionError };

export type EncounterTransitionInput = {
  encounter: any;
  nextStatus: string;
  statusOrder: readonly string[];
  triageDoc?: any | null;
  dispositionDoc?: any | null;
  allowDecisionBridge?: boolean;
  validateDisposition: (disposition: any) => { isValid: boolean; missing: string[] };
  validateTriageCompletionInput: (input: {
    chiefComplaint?: string | null;
    vitals?: {
      systolic?: number | null;
      diastolic?: number | null;
      HR?: number | null;
      RR?: number | null;
      TEMP?: number | null;
      SPO2?: number | null;
    } | null;
    triageLevel?: number | null;
  }) => { missing: string[] };
};

function expectedDispositionType(nextStatus: string): 'DISCHARGE' | 'ADMIT' | 'TRANSFER' | null {
  if (nextStatus === 'DISCHARGED') return 'DISCHARGE';
  if (nextStatus === 'ADMITTED') return 'ADMIT';
  if (nextStatus === 'TRANSFERRED') return 'TRANSFER';
  return null;
}

export function validateErEncounterTransition(input: EncounterTransitionInput): EncounterTransitionResult {
  const {
    encounter,
    nextStatus,
    triageDoc,
    dispositionDoc,
    allowDecisionBridge,
    statusOrder,
    validateDisposition,
    validateTriageCompletionInput,
  } = input;

  const normalizeErStatus = (status: string) => (status === 'TRIAGED' ? 'TRIAGE_COMPLETED' : status);
  const statusRank = (status: string) => statusOrder.indexOf(normalizeErStatus(status));

  // Explicit ER status map: central source of allowed transitions (from -> to).
  const allowedFrom = ER_TRANSITIONS;

  // Rule: block unknown or unsupported statuses (keep behavior deterministic).
  if (!statusOrder.includes(nextStatus)) {
    return {
      ok: false,
      error: { status: 400, body: { error: 'Invalid status' } },
    };
  }

  const normalizedCurrent = normalizeErStatus(String(encounter.status || ''));
  const allowedNext =
    (allowedFrom as Record<string, readonly string[]>)[normalizedCurrent] || [];
  const directAllowed = allowedNext.includes(nextStatus) || normalizedCurrent === nextStatus;
  const decisionBridgeAllowed =
    Boolean(allowDecisionBridge) &&
    (FINAL_STATUSES as readonly string[]).includes(nextStatus) &&
    ((allowedFrom as Record<string, readonly string[]>)[normalizedCurrent] || []).includes('DECISION');

  // Rule: only allow declared transitions (and optional DECISION bridge for finalize routes).
  if (!directAllowed && !decisionBridgeAllowed) {
    return {
      ok: false,
      error: {
        status: 400,
        body: { error: 'Invalid status transition', from: String(encounter.status || ''), to: nextStatus },
      },
    };
  }

  // Rule: triage completion must include mandatory clinical fields before advancing.
  if (nextStatus === 'TRIAGE_COMPLETED') {
    const currentRank = statusRank(String(encounter.status || ''));
    const completedRank = statusRank('TRIAGE_COMPLETED');
    if (completedRank !== -1 && (currentRank === -1 || currentRank < completedRank)) {
      const vitals = triageDoc?.vitals || {};
      const triageValidation = validateTriageCompletionInput({
        chiefComplaint: String(encounter.chiefComplaint || '').trim(),
        vitals: {
          systolic: vitals.systolic ?? null,
          diastolic: vitals.diastolic ?? null,
          HR: vitals.HR ?? null,
          RR: vitals.RR ?? null,
          TEMP: vitals.TEMP ?? null,
          SPO2: vitals.SPO2 ?? null,
        },
        triageLevel: encounter.triageLevel ?? triageDoc?.triageLevel ?? null,
      });
      if (triageValidation.missing.length > 0) {
        return {
          ok: false,
          error: { status: 409, body: { error: 'Triage incomplete', missing: triageValidation.missing } },
        };
      }
    }
  }

  // Rule: finalization requires a complete disposition and matching type.
  if ((FINAL_STATUSES as readonly string[]).includes(nextStatus)) {
    const validation = validateDisposition(dispositionDoc);
    if (!validation.isValid) {
      return {
        ok: false,
        error: { status: 409, body: { error: 'Disposition incomplete', missing: validation.missing } },
      };
    }

    const expectedType = expectedDispositionType(nextStatus);
    if (expectedType && dispositionDoc?.type !== expectedType) {
      return {
        ok: false,
        error: {
          status: 409,
          body: {
            error: 'Disposition type mismatch',
            expectedType,
            currentType: dispositionDoc?.type || null,
          },
        },
      };
    }
  }

  return { ok: true };
}
