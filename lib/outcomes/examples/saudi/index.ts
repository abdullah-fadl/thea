/**
 * Phase 8.4 — Saudi outcome metrics registration barrel
 *
 * Boot-time registration of 15 Saudi-relevant outcomes wired to events from
 * Phase 7.4 (Thea Health), Phase 7.5 (CVision/Imdad/SAM), Phase 8.3 (clinical
 * alerts), and Phase 8.4 (scaffolded clinical-flow + RCM events).
 *
 * Behaviour:
 *   - When FF_OUTCOME_METRICS_ENABLED is OFF, every register*() call inside
 *     this barrel is a no-op (registerOutcome short-circuits — see
 *     lib/outcomes/registry.ts). registerSaudiOutcomes() returns an empty
 *     report and writes nothing.
 *   - When FF_OUTCOME_METRICS_ENABLED is ON, all 15 outcomes are registered.
 *     Outcomes whose source events are scaffolded but not yet emitted get
 *     a one-line console.info under category `outcomes.deferred-emit` so
 *     operators see at a glance which dashboards will read sampleSize=0
 *     until emit wiring lands. Registration always succeeds — the events
 *     registry knows the schema, so emit-time validation will work the
 *     moment a route starts producing them.
 *
 * Idempotency:
 *   The underlying registerOutcome() throws OutcomeDuplicateKey if the same
 *   outcome key is registered twice with the flag ON. registerSaudiOutcomes()
 *   inherits that contract — call it exactly once at boot.
 */

import { registerErDoorToProviderMinutes, erDoorToProviderMinutesDefinition } from './er-door-to-provider-minutes';
import { registerLabTurnaroundTimeMinutes, labTurnaroundTimeMinutesDefinition } from './lab-turnaround-time-minutes';
import { registerEncounterCompletionRatePct, encounterCompletionRatePctDefinition } from './encounter-completion-rate-pct';
import { registerCriticalLabAlertResponseTime, criticalLabAlertResponseTimeDefinition } from './critical-lab-alert-response-time';
import { registerThirtyDayReadmissionRate, thirtyDayReadmissionRateDefinition } from './30-day-readmission-rate';
import { registerMedicationErrorRate, medicationErrorRateDefinition } from './medication-error-rate';
import { registerBedOccupancyRate, bedOccupancyRateDefinition } from './bed-occupancy-rate';
import { registerAppointmentNoShowRate, appointmentNoShowRateDefinition } from './appointment-no-show-rate';
import {
  registerStaffMandatoryTrainingCompliance,
  staffMandatoryTrainingComplianceDefinition,
} from './staff-mandatory-training-compliance-pct';
import { registerClaimApprovalRatePct, claimApprovalRatePctDefinition } from './claim-approval-rate-pct';
import { registerEligibilitySuccessRatePct, eligibilitySuccessRatePctDefinition } from './eligibility-success-rate-pct';
import { registerRevenueCycleDays, revenueCycleDaysDefinition } from './revenue-cycle-days';
import { registerStockThresholdBreachRate, stockThresholdBreachRateDefinition } from './stock-threshold-breach-rate';
import {
  registerPurchaseOrderCycleTimeDays,
  purchaseOrderCycleTimeDaysDefinition,
} from './purchase-order-cycle-time-days';
import { registerStaffTurnoverRatePct, staffTurnoverRatePctDefinition } from './staff-turnover-rate-pct';

import type { OutcomeDefinition } from '../../types';
import { isEnabled } from '@/lib/core/flags';
import { listOutcomes } from '../../registry';

export {
  erDoorToProviderMinutesDefinition,
  labTurnaroundTimeMinutesDefinition,
  encounterCompletionRatePctDefinition,
  criticalLabAlertResponseTimeDefinition,
  thirtyDayReadmissionRateDefinition,
  medicationErrorRateDefinition,
  bedOccupancyRateDefinition,
  appointmentNoShowRateDefinition,
  staffMandatoryTrainingComplianceDefinition,
  claimApprovalRatePctDefinition,
  eligibilitySuccessRatePctDefinition,
  revenueCycleDaysDefinition,
  stockThresholdBreachRateDefinition,
  purchaseOrderCycleTimeDaysDefinition,
  staffTurnoverRatePctDefinition,
};

interface SaudiRegistrationEntry {
  definition: OutcomeDefinition;
  register: () => void;
}

const SAUDI_OUTCOMES: ReadonlyArray<SaudiRegistrationEntry> = [
  // Clinical (5)
  { definition: erDoorToProviderMinutesDefinition,         register: registerErDoorToProviderMinutes },
  { definition: labTurnaroundTimeMinutesDefinition,        register: registerLabTurnaroundTimeMinutes },
  { definition: encounterCompletionRatePctDefinition,      register: registerEncounterCompletionRatePct },
  { definition: criticalLabAlertResponseTimeDefinition,    register: registerCriticalLabAlertResponseTime },
  { definition: thirtyDayReadmissionRateDefinition,        register: registerThirtyDayReadmissionRate },
  // Operational (4)
  { definition: medicationErrorRateDefinition,             register: registerMedicationErrorRate },
  { definition: bedOccupancyRateDefinition,                register: registerBedOccupancyRate },
  { definition: appointmentNoShowRateDefinition,           register: registerAppointmentNoShowRate },
  { definition: staffMandatoryTrainingComplianceDefinition, register: registerStaffMandatoryTrainingCompliance },
  // Financial / NPHIES (3)
  { definition: claimApprovalRatePctDefinition,            register: registerClaimApprovalRatePct },
  { definition: eligibilitySuccessRatePctDefinition,       register: registerEligibilitySuccessRatePct },
  { definition: revenueCycleDaysDefinition,                register: registerRevenueCycleDays },
  // Procurement (2)
  { definition: stockThresholdBreachRateDefinition,        register: registerStockThresholdBreachRate },
  { definition: purchaseOrderCycleTimeDaysDefinition,      register: registerPurchaseOrderCycleTimeDays },
  // HR (1)
  { definition: staffTurnoverRatePctDefinition,            register: registerStaffTurnoverRatePct },
];

/** Returns the 15 Saudi outcome definitions in registration order — useful for tests and tooling. */
export function listSaudiOutcomeDefinitions(): OutcomeDefinition[] {
  return SAUDI_OUTCOMES.map(entry => entry.definition);
}

export interface SaudiRegistrationReport {
  /** Number of outcomes registered on this call (excludes ones already in the registry). */
  registered: number;
  /** Number of outcomes that were already in the registry from a prior call (idempotent skip). */
  alreadyRegistered: number;
  skippedFlagOff: boolean;
  emitDeferred: string[];
}

/**
 * Register all 15 Saudi outcomes at boot. Idempotent — outcomes already
 * present in the registry (e.g. a re-call from a hot-reload or a script
 * that re-imports the barrel) are silently skipped.
 *
 * Behaviour:
 *   - Flag OFF: no-op, report.skippedFlagOff = true.
 *   - Flag ON, first call: registers all 15, registered = 15.
 *   - Flag ON, repeat call: registered = 0, alreadyRegistered = 15.
 *
 * Returns a small report so operators / tests can confirm what landed and
 * which outcomes are pending future emit wiring (the `emit-deferred` tag).
 */
export function registerSaudiOutcomes(): SaudiRegistrationReport {
  if (!isEnabled('FF_OUTCOME_METRICS_ENABLED')) {
    return { registered: 0, alreadyRegistered: 0, skippedFlagOff: true, emitDeferred: [] };
  }

  const existingKeys = new Set(listOutcomes().map(o => o.key));
  let registered = 0;
  let alreadyRegistered = 0;
  const emitDeferred: string[] = [];

  for (const entry of SAUDI_OUTCOMES) {
    if (existingKeys.has(entry.definition.key)) {
      alreadyRegistered++;
    } else {
      entry.register();
      registered++;
    }
    if (entry.definition.tags.includes('emit-deferred')) {
      emitDeferred.push(entry.definition.key);
    }
  }

  if (registered > 0 && emitDeferred.length > 0) {
    // Single-line, structured log so ops dashboards can pick it up. Avoids
    // pulling in a logger dep — these registrations happen at boot before
    // any logger init.
    // eslint-disable-next-line no-console
    console.info(
      `[outcomes.saudi] registered ${registered} Saudi outcomes ` +
        `(${emitDeferred.length} emit-deferred — keys: ${emitDeferred.join(', ')})`,
    );
  }

  return {
    registered,
    alreadyRegistered,
    skippedFlagOff: false,
    emitDeferred,
  };
}
