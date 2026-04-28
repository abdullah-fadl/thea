import { registerOutcome } from '../../registry';
import type { OutcomeDefinition } from '../../types';

// =============================================================================
// Saudi outcome — Mandatory training compliance (Phase 8.4)
//
// Count of `policy.acknowledged@v1` events per period — i.e. how many
// SAM policy acknowledgments the workforce produced. CBAHI accreditation
// surveys require ≥ 95 % of active staff to have acknowledged each
// mandatory policy by year-end; the period-level count is the upstream
// signal that feeds into a denominator (active employees) computed by the
// dashboard layer.
//
// Headline target = 250 acknowledgments per period (assuming a tenant of
// ~500 active staff with monthly mandatory-policy refreshes); ±50 leaves
// noise tolerance. Tenants with different headcount tune the target.
//
// Source events (already emitted as of Phase 7.5):
//   - policy.acknowledged@v1
//
// Note: a true "compliance %" requires a per-policy active-employee
// denominator that the cross-platform event bus alone cannot supply
// without a join. Phase 8.5's planned `cohort` formula kind will
// graduate this from raw count to ratio.
// =============================================================================

export const staffMandatoryTrainingComplianceDefinition: OutcomeDefinition = {
  key: 'saudi.sam.mandatory_training_acknowledgments_count',
  name: 'Mandatory Training Acknowledgments (CBAHI)',
  description:
    'Count of SAM policy acknowledgments per period. CBAHI mandatory-training compliance requires ≥ 95 % of active staff to have acknowledged each policy. Phase 8.5 graduates this to a ratio.',
  unit: 'count',
  direction: 'higher_is_better',
  target: 250,
  targetTolerance: 50,
  formula: {
    kind: 'count',
    eventName: 'policy.acknowledged@v1',
  },
  tags: ['saudi', 'cbahi', 'sam', 'training-compliance'],
  status: 'active',
};

export function registerStaffMandatoryTrainingCompliance(): void {
  registerOutcome(staffMandatoryTrainingComplianceDefinition);
}
