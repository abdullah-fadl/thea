import { registerOutcome } from '../../registry';
import type { OutcomeDefinition } from '../../types';

// =============================================================================
// Saudi outcome — Bed occupancy rate (Phase 8.4)
//
// IPD bed occupancy = (occupied bed-days / available bed-days) × 100. The
// Saudi MoH 2024 capacity-planning framework targets 80–85 % occupancy as
// the operating sweet spot: < 75 % suggests under-utilisation, > 90 %
// erodes ED throughput and raises mortality (the so-called "occupancy
// cliff").
//
// Status: emit-deferred — the IPD admission/discharge events
// (`ipd.admission.opened@v1`, `ipd.bed.released@v1`) are not yet defined
// in Phase 7.x. The placeholder formula below references the closest
// existing OPD signal so the dashboard renders a row from day 1, but the
// figure is meaningful only once IPD events ship. See NOTES.md
// §Phase 8.4 deferred-wiring list.
//
// Source events (NOT YET EMITTED — placeholder uses encounter.opened):
//   - ipd.admission.opened@v1   (planned)
//   - ipd.bed.released@v1       (planned)
// =============================================================================

export const bedOccupancyRateDefinition: OutcomeDefinition = {
  key: 'saudi.ipd.bed_occupancy_rate_pct',
  name: 'IPD Bed Occupancy Rate (Saudi MoH)',
  description:
    'Percentage of available IPD bed-days occupied during the period. Saudi MoH operating target 80–85 %; > 90 % erodes ED throughput. Awaiting IPD admission/discharge events (Phase 8.x).',
  unit: '%',
  direction: 'target',
  target: 82,
  targetTolerance: 3,
  formula: {
    kind: 'ratio_of_counts',
    numeratorEvent: 'ipd.admission.opened@v1',
    denominatorEvent: 'ipd.bed.released@v1',
  },
  tags: ['saudi', 'moh', 'ipd', 'capacity', 'bed-occupancy', 'emit-deferred'],
  status: 'active',
};

export function registerBedOccupancyRate(): void {
  registerOutcome(bedOccupancyRateDefinition);
}
