import { registerOutcome } from '../../registry';
import type { OutcomeDefinition } from '../../types';

// =============================================================================
// Saudi outcome — Medication error rate per 1,000 medication orders (Phase 8.4)
//
// Ratio of medication-related `incident.reported@v1` events to
// `order.placed@v1` events with kind=PHARMACY in the same period. The
// formula returns a percentage (0–100); reading it as "errors per
// 1,000 orders" requires multiplying the percentage by 10 in the dashboard
// layer (we don't introduce a per-mille formula kind for one outcome).
//
// CBAHI medication safety standards target ≤ 5 errors per 1,000 medication
// orders for non-harm events; ≥ 10 triggers a corrective action plan. The
// dashboard target of 0.5 % equals 5 / 1,000 with ±0.2 % tolerance.
//
// Source events (BOTH already emitted as of Phase 7.4 / 7.5):
//   - incident.reported@v1   (numerator — filtered to type containing 'medication')
//   - order.placed@v1        (denominator — filtered to kind=PHARMACY)
//
// Filter caveat: `incident.reported@v1` carries a `type` enum whose exact
// values depend on the QualityIncident.type column at emit time. We filter
// on `type: 'medication'` here; tenants with different type taxonomies
// (e.g. 'medication_error', 'pharmacy_event') should fork the formula.
// =============================================================================

export const medicationErrorRateDefinition: OutcomeDefinition = {
  key: 'saudi.pharmacy.medication_error_rate_pct',
  name: 'Medication Error Rate (CBAHI)',
  description:
    'Percentage of medication orders that resulted in a reported medication-related quality incident. Multiply by 10 to read as "errors per 1,000 orders". CBAHI target ≤ 0.5 % (= 5 / 1,000).',
  unit: '%',
  direction: 'lower_is_better',
  target: 0.5,
  targetTolerance: 0.2,
  formula: {
    kind: 'ratio_of_counts',
    numeratorEvent: 'incident.reported@v1',
    denominatorEvent: 'order.placed@v1',
    numeratorFilter: { type: 'medication' },
    denominatorFilter: { kind: 'PHARMACY' },
  },
  tags: ['saudi', 'cbahi', 'pharmacy', 'medication-safety'],
  status: 'active',
};

export function registerMedicationErrorRate(): void {
  registerOutcome(medicationErrorRateDefinition);
}
