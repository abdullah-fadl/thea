import { OPD_FLOW_STATES, OPDFlowState } from '@/lib/models/OPDEncounter';

const OPD_FLOW_STATE_SET = new Set(OPD_FLOW_STATES);

export type OpdFlowStateKey = OPDFlowState | 'START' | 'UNKNOWN';

/**
 * OPD Flow State Machine — enforces clinical workflow ordering.
 *
 * Normal forward path:
 *   START → ARRIVED → WAITING_NURSE → IN_NURSING → READY_FOR_DOCTOR
 *         → WAITING_DOCTOR → IN_DOCTOR → COMPLETED
 *
 * Optional procedure loop from IN_DOCTOR:
 *   IN_DOCTOR → PROCEDURE_PENDING → PROCEDURE_DONE_WAITING → IN_DOCTOR
 *
 * Return-to-nursing (doctor sends patient back for additional vitals/assessment):
 *   IN_DOCTOR → WAITING_NURSE | IN_NURSING
 *
 * Rules:
 *   - START can only go to ARRIVED (no skipping ahead)
 *   - ARRIVED must go through nursing before reaching doctor
 *   - Only IN_DOCTOR, PROCEDURE_PENDING, PROCEDURE_DONE_WAITING can reach COMPLETED
 *   - COMPLETED is terminal (no further transitions)
 */
export const OPD_FLOW_STATE_TRANSITIONS: Record<OpdFlowStateKey, OPDFlowState[]> = {
  START: ['ARRIVED'],
  ARRIVED: ['WAITING_NURSE'],
  WAITING_NURSE: ['IN_NURSING'],
  IN_NURSING: ['READY_FOR_DOCTOR'],
  READY_FOR_DOCTOR: ['WAITING_DOCTOR', 'IN_DOCTOR'],
  WAITING_DOCTOR: ['IN_DOCTOR'],
  IN_DOCTOR: ['PROCEDURE_PENDING', 'COMPLETED', 'WAITING_NURSE', 'IN_NURSING'],
  PROCEDURE_PENDING: ['PROCEDURE_DONE_WAITING', 'IN_DOCTOR'],
  PROCEDURE_DONE_WAITING: ['IN_DOCTOR', 'COMPLETED'],
  COMPLETED: [],
  UNKNOWN: [],
};

function normalizeFlowState(value: any): OPDFlowState | '' {
  const normalized = String(value || '').trim().toUpperCase();
  return OPD_FLOW_STATE_SET.has(normalized as OPDFlowState) ? (normalized as OPDFlowState) : '';
}

export function getAllowedOpdFlowTransitions(currentRaw: any): {
  current: OpdFlowStateKey;
  allowed: OPDFlowState[];
} {
  const normalized = normalizeFlowState(currentRaw);
  if (!normalized) {
    if (String(currentRaw || '').trim()) {
      return { current: 'UNKNOWN', allowed: OPD_FLOW_STATE_TRANSITIONS.UNKNOWN };
    }
    return { current: 'START', allowed: OPD_FLOW_STATE_TRANSITIONS.START };
  }
  return { current: normalized, allowed: OPD_FLOW_STATE_TRANSITIONS[normalized] || [] };
}

export function isOpdFlowTransitionAllowed(currentRaw: any, nextState: OPDFlowState) {
  const { current, allowed } = getAllowedOpdFlowTransitions(currentRaw);
  return { current, allowed, ok: allowed.includes(nextState) };
}
