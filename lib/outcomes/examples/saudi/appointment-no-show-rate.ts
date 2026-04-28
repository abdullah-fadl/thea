import { registerOutcome } from '../../registry';
import type { OutcomeDefinition } from '../../types';

// =============================================================================
// Saudi outcome — Appointment no-show rate (Phase 8.4)
//
// Ratio of `appointment.no_show@v1` events (numerator) to scheduled
// appointment opens (denominator — proxied here by `encounter.opened@v1`
// since the OPD scheduler doesn't yet emit a dedicated `appointment.scheduled`
// event, and the encounter.opened pulse arrives on the same patient/slot
// window). Once the scheduler emits `appointment.scheduled@v1`, swap the
// denominator — that's a one-line fork.
//
// Saudi OPD benchmarks vary widely (urban tertiary 8–12 %, primary care
// 18–25 %); we headline 12 % as the dashboard target with ±5 % tolerance,
// leaving room for tenant-specific overrides.
//
// Source events:
//   - appointment.no_show@v1    — Phase 8.4 SCAFFOLD (not yet emitted)
//   - encounter.opened@v1       — Phase 7.4 LIVE (denominator proxy)
//
// Status: emit-deferred — numerator scaffolded, no scheduler route emits
// it yet; until then computeOutcome returns 0 (no events match).
// =============================================================================

export const appointmentNoShowRateDefinition: OutcomeDefinition = {
  key: 'saudi.scheduler.no_show_rate_pct',
  name: 'Appointment No-Show Rate',
  description:
    'Percentage of scheduled OPD appointments where the patient did not arrive within the slot window. Saudi tertiary-OPD target ≤ 12 %.',
  unit: '%',
  direction: 'lower_is_better',
  target: 12,
  targetTolerance: 5,
  formula: {
    kind: 'ratio_of_counts',
    numeratorEvent: 'appointment.no_show@v1',
    denominatorEvent: 'encounter.opened@v1',
  },
  tags: ['saudi', 'scheduler', 'opd', 'no-show', 'emit-deferred'],
  status: 'active',
};

export function registerAppointmentNoShowRate(): void {
  registerOutcome(appointmentNoShowRateDefinition);
}
