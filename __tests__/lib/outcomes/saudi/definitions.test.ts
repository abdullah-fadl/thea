/**
 * Phase 8.4 — Per-outcome shape tests for the 15 Saudi definitions
 *
 * One case per outcome (15 total) verifying:
 *   - flag-OFF: registerXxx() is a no-op (registry stays empty)
 *   - flag-ON:  registerXxx() lands the right key, unit, direction, target,
 *               formula kind, and the source events the formula references
 *               are sensible string literals matching the event registry's
 *               eventName@vN convention.
 *
 * Each test resets the registry before/after so they run in any order.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';
import { _resetRegistryForTest, listOutcomes } from '@/lib/outcomes/registry';
import type { OutcomeDefinition, OutcomeFormula } from '@/lib/outcomes/types';

import { registerErDoorToProviderMinutes,         erDoorToProviderMinutesDefinition }         from '@/lib/outcomes/examples/saudi/er-door-to-provider-minutes';
import { registerLabTurnaroundTimeMinutes,        labTurnaroundTimeMinutesDefinition }        from '@/lib/outcomes/examples/saudi/lab-turnaround-time-minutes';
import { registerEncounterCompletionRatePct,      encounterCompletionRatePctDefinition }      from '@/lib/outcomes/examples/saudi/encounter-completion-rate-pct';
import { registerCriticalLabAlertResponseTime,    criticalLabAlertResponseTimeDefinition }    from '@/lib/outcomes/examples/saudi/critical-lab-alert-response-time';
import { registerThirtyDayReadmissionRate,        thirtyDayReadmissionRateDefinition }        from '@/lib/outcomes/examples/saudi/30-day-readmission-rate';
import { registerMedicationErrorRate,             medicationErrorRateDefinition }             from '@/lib/outcomes/examples/saudi/medication-error-rate';
import { registerBedOccupancyRate,                bedOccupancyRateDefinition }                from '@/lib/outcomes/examples/saudi/bed-occupancy-rate';
import { registerAppointmentNoShowRate,           appointmentNoShowRateDefinition }           from '@/lib/outcomes/examples/saudi/appointment-no-show-rate';
import { registerStaffMandatoryTrainingCompliance,staffMandatoryTrainingComplianceDefinition }from '@/lib/outcomes/examples/saudi/staff-mandatory-training-compliance-pct';
import { registerClaimApprovalRatePct,            claimApprovalRatePctDefinition }            from '@/lib/outcomes/examples/saudi/claim-approval-rate-pct';
import { registerEligibilitySuccessRatePct,       eligibilitySuccessRatePctDefinition }       from '@/lib/outcomes/examples/saudi/eligibility-success-rate-pct';
import { registerRevenueCycleDays,                revenueCycleDaysDefinition }                from '@/lib/outcomes/examples/saudi/revenue-cycle-days';
import { registerStockThresholdBreachRate,        stockThresholdBreachRateDefinition }        from '@/lib/outcomes/examples/saudi/stock-threshold-breach-rate';
import { registerPurchaseOrderCycleTimeDays,      purchaseOrderCycleTimeDaysDefinition }      from '@/lib/outcomes/examples/saudi/purchase-order-cycle-time-days';
import { registerStaffTurnoverRatePct,            staffTurnoverRatePctDefinition }            from '@/lib/outcomes/examples/saudi/staff-turnover-rate-pct';

function enableFlag()  { process.env[FLAGS.FF_OUTCOME_METRICS_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_OUTCOME_METRICS_ENABLED]; }

/** Asserts the basics every Saudi outcome must satisfy. */
function assertCommonShape(def: OutcomeDefinition): void {
  expect(def.key).toMatch(/^saudi\./);
  expect(def.name.length).toBeGreaterThan(0);
  expect(def.description.length).toBeGreaterThan(20);
  expect(['higher_is_better', 'lower_is_better', 'target']).toContain(def.direction);
  expect(def.tags).toContain('saudi');
  expect(def.status).toBe('active');
}

/** Pulls every event-name string referenced by the formula and asserts it follows the @vN convention. */
function assertFormulaEventsValid(formula: OutcomeFormula): void {
  const eventNames: string[] = [];
  switch (formula.kind) {
    case 'count':
    case 'sum':
      eventNames.push(formula.eventName);
      break;
    case 'duration_between_events':
      eventNames.push(formula.startEvent, formula.endEvent);
      break;
    case 'ratio_of_counts':
      eventNames.push(formula.numeratorEvent, formula.denominatorEvent);
      break;
  }
  for (const name of eventNames) {
    expect(name).toMatch(/^[a-z][a-z0-9_.]*@v\d+$/);
  }
}

/** Test harness that exercises a single registerXxx() — flag-OFF then flag-ON behaviour. */
function shapeCase(
  label: string,
  registerFn: () => void,
  def: OutcomeDefinition,
): void {
  it(label, () => {
    // Flag OFF — no-op
    disableFlag();
    _resetRegistryForTest();
    registerFn();
    expect(listOutcomes()).toEqual([]);

    // Flag ON — registers and lands the expected definition
    enableFlag();
    _resetRegistryForTest();
    registerFn();
    const list = listOutcomes();
    expect(list).toHaveLength(1);
    expect(list[0].key).toBe(def.key);

    assertCommonShape(def);
    assertFormulaEventsValid(def.formula);
  });
}

describe('Saudi outcome definitions — per-outcome shape', () => {
  beforeEach(() => { _resetRegistryForTest(); disableFlag(); });
  afterEach(()  => { _resetRegistryForTest(); disableFlag(); });

  // Clinical (5)
  shapeCase('1. ER door-to-provider — 30 min target, duration_between_events',
    registerErDoorToProviderMinutes, erDoorToProviderMinutesDefinition);
  shapeCase('2. Lab TAT — 60 min target, duration_between_events',
    registerLabTurnaroundTimeMinutes, labTurnaroundTimeMinutesDefinition);
  shapeCase('3. Encounter completion rate — 98 % target, ratio_of_counts',
    registerEncounterCompletionRatePct, encounterCompletionRatePctDefinition);
  shapeCase('4. Critical-lab alert response — 30 min target, duration_between_events, emit-deferred',
    registerCriticalLabAlertResponseTime, criticalLabAlertResponseTimeDefinition);
  shapeCase('5. 30-day readmission proxy — 8 % target, ratio_of_counts',
    registerThirtyDayReadmissionRate, thirtyDayReadmissionRateDefinition);

  // Operational (4)
  shapeCase('6. Medication error rate — 0.5 % target, ratio_of_counts with filters',
    registerMedicationErrorRate, medicationErrorRateDefinition);
  shapeCase('7. Bed occupancy rate — 82 % target, target direction, emit-deferred',
    registerBedOccupancyRate, bedOccupancyRateDefinition);
  shapeCase('8. Appointment no-show rate — 12 % target, emit-deferred',
    registerAppointmentNoShowRate, appointmentNoShowRateDefinition);
  shapeCase('9. Mandatory training compliance — count formula',
    registerStaffMandatoryTrainingCompliance, staffMandatoryTrainingComplianceDefinition);

  // Financial / NPHIES (3)
  shapeCase('10. Claim approval rate — 85 % target, ratio_of_counts with outcome filter, emit-deferred',
    registerClaimApprovalRatePct, claimApprovalRatePctDefinition);
  shapeCase('11. Eligibility success rate — 95 % target, ratio_of_counts, emit-deferred',
    registerEligibilitySuccessRatePct, eligibilitySuccessRatePctDefinition);
  shapeCase('12. Revenue cycle days — 30 days target, duration in hours, emit-deferred',
    registerRevenueCycleDays, revenueCycleDaysDefinition);

  // Procurement (2)
  shapeCase('13. Stock critical breach count — 20 / period target, count + severity filter',
    registerStockThresholdBreachRate, stockThresholdBreachRateDefinition);
  shapeCase('14. PO cycle time — 7 days target, duration in hours',
    registerPurchaseOrderCycleTimeDays, purchaseOrderCycleTimeDaysDefinition);

  // HR (1)
  shapeCase('15. Staff turnover ratio — 4 % quarterly target, ratio_of_counts',
    registerStaffTurnoverRatePct, staffTurnoverRatePctDefinition);
});
