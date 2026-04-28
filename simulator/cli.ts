#!/usr/bin/env npx tsx
/**
 * Thea Hospital Simulator — CLI Entry Point
 *
 * Usage:
 *   yarn sim                        # Run all scenarios once
 *   yarn sim --speed 1000           # Fast mode
 *   yarn sim --modules opd,er       # Specific modules
 *   yarn sim --duration 60          # Continuous for 60 min
 *   yarn sim --concurrency 10       # 10 parallel scenarios
 *   yarn sim --profile smoke        # Quick test
 *   yarn sim --profile stress       # Stress test
 */

import { SimulationEngine } from './core/engine';
import { DEFAULT_CONFIG, PROFILES, type SimulationConfig } from './config/default';

// --- Scenario imports ---
import { OpdRoutineVisit } from './scenarios/opd-routine-visit';
import { OpdVisitWithLabs } from './scenarios/opd-visit-with-labs';
import { OpdFollowUp } from './scenarios/opd-follow-up';
import { ErWalkinDischarge } from './scenarios/er-walkin-discharge';
import { ErAdmitToIpd } from './scenarios/er-admit-to-ipd';
import { ErUnknownPatient } from './scenarios/er-unknown-patient';
import { IpdStayDischarge } from './scenarios/ipd-stay-discharge';
import { IpdBedTransfer } from './scenarios/ipd-bed-transfer';
import { IcuAdmission } from './scenarios/icu-admission';
import { OrScheduledSurgery } from './scenarios/or-scheduled-surgery';
import { ObgynLaborDelivery } from './scenarios/obgyn-labor-delivery';
import { RadiologyRoutineStudy } from './scenarios/radiology-routine-study';
import { RadiologyCriticalFinding } from './scenarios/radiology-critical-finding';
import { DentalExamTreatment } from './scenarios/dental-exam-treatment';
import { LabFullCycle } from './scenarios/lab-full-cycle';
import { PharmacyDispenseCycle } from './scenarios/pharmacy-dispense-cycle';
import { BillingCashVisit } from './scenarios/billing-cash-visit';
import { BillingInsuranceClaim } from './scenarios/billing-insurance-claim';
import { SchedulingFullCycle } from './scenarios/scheduling-full-cycle';
import { PortalPatientJourney } from './scenarios/portal-patient-journey';
import { PortalDataExportScenario } from './scenarios/portal-data-export';
import { FullHospitalJourney } from './scenarios/full-hospital-journey';
import { CrossTenantIsolation } from './scenarios/cross-tenant-isolation';
import { FailureMidSurgery } from './scenarios/failure-mid-surgery';
import { FailureMidLab } from './scenarios/failure-mid-lab';
import { FailureMidAdmission } from './scenarios/failure-mid-admission';
import { CriticalLabNotification } from './scenarios/critical-lab-notification';
import { CriticalRadiologyNotification } from './scenarios/critical-radiology-notification';
import { PdplErasureScenario } from './scenarios/pdpl-erasure';

// --- CVision (HR) scenario imports ---
import { CVisionOrgSetup } from './scenarios/cvision-org-setup';
import { CVisionHireFullCycle } from './scenarios/cvision-hire-full-cycle';
import { CVisionEmployeeLifecycle } from './scenarios/cvision-employee-lifecycle';
import { CVisionPayrollCycle } from './scenarios/cvision-payroll-cycle';
import { CVisionLeaveManagement } from './scenarios/cvision-leave-management';
import { CVisionAttendanceTracking } from './scenarios/cvision-attendance-tracking';
import { CVisionRequestManagement } from './scenarios/cvision-request-management';
import { CVisionGrievanceFlow } from './scenarios/cvision-grievance-flow';
import { CVisionPerformanceReview } from './scenarios/cvision-performance-review';
import { CVisionInsuranceBenefits } from './scenarios/cvision-insurance-benefits';
import { CVisionEmployeeSelfService } from './scenarios/cvision-employee-self-service';
import { CVisionRBACIsolation } from './scenarios/cvision-rbac-isolation';
import { CVisionTrainingEnrollment } from './scenarios/cvision-training-enrollment';
import { CVisionOnboardingOffboarding } from './scenarios/cvision-onboarding-offboarding';
import { CVisionQuickHire } from './scenarios/cvision-quick-hire';
import { CVisionEOSCalculation } from './scenarios/cvision-eos-calculation';

function parseArgs(): Partial<SimulationConfig> & { profile?: string } {
  const args = process.argv.slice(2);
  const result: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace('--', '');
      result[key] = args[i + 1] || 'true';
      i++;
    }
  }

  const overrides: Partial<SimulationConfig> & { profile?: string } = {};

  if (result.profile) overrides.profile = result.profile;
  if (result.speed) overrides.speed = Number(result.speed);
  if (result.concurrency) overrides.concurrency = Number(result.concurrency);
  if (result.duration) overrides.duration = Number(result.duration);
  if (result.modules) overrides.modules = result.modules.split(',') as SimulationConfig['modules'];
  if (result.url) overrides.baseUrl = result.url;

  return overrides;
}

function buildConfig(overrides: Partial<SimulationConfig> & { profile?: string }): SimulationConfig {
  let base = { ...DEFAULT_CONFIG };

  // Apply profile if specified
  if (overrides.profile && PROFILES[overrides.profile as keyof typeof PROFILES]) {
    const profile = PROFILES[overrides.profile as keyof typeof PROFILES];
    base = { ...base, ...profile };
  }

  // Apply CLI overrides
  return {
    ...base,
    ...overrides,
    tenants: base.tenants, // Don't override tenants from CLI
  } as SimulationConfig;
}

function getAllScenarios() {
  return [
    // OPD (3)
    new OpdRoutineVisit(),
    new OpdVisitWithLabs(),
    new OpdFollowUp(),
    // ER (3)
    new ErWalkinDischarge(),
    new ErAdmitToIpd(),
    new ErUnknownPatient(),
    // IPD (2)
    new IpdStayDischarge(),
    new IpdBedTransfer(),
    // ICU (1)
    new IcuAdmission(),
    // OR (1)
    new OrScheduledSurgery(),
    // OB/GYN (1)
    new ObgynLaborDelivery(),
    // Radiology (2)
    new RadiologyRoutineStudy(),
    new RadiologyCriticalFinding(),
    // Dental (1)
    new DentalExamTreatment(),
    // Lab + Pharmacy (2)
    new LabFullCycle(),
    new PharmacyDispenseCycle(),
    // Billing (2)
    new BillingCashVisit(),
    new BillingInsuranceClaim(),
    // Scheduling (1)
    new SchedulingFullCycle(),
    // Portal (2)
    new PortalPatientJourney(),
    new PortalDataExportScenario(),
    // Cross-department (2)
    new FullHospitalJourney(),
    new CrossTenantIsolation(),
    // Resilience (3)
    new FailureMidSurgery(),
    new FailureMidLab(),
    new FailureMidAdmission(),
    // Notifications (2)
    new CriticalLabNotification(),
    new CriticalRadiologyNotification(),
    // Privacy (1)
    new PdplErasureScenario(),
    // CVision HR (16)
    new CVisionOrgSetup(),
    new CVisionHireFullCycle(),
    new CVisionEmployeeLifecycle(),
    new CVisionPayrollCycle(),
    new CVisionLeaveManagement(),
    new CVisionAttendanceTracking(),
    new CVisionRequestManagement(),
    new CVisionGrievanceFlow(),
    new CVisionPerformanceReview(),
    new CVisionInsuranceBenefits(),
    new CVisionEmployeeSelfService(),
    new CVisionRBACIsolation(),
    new CVisionTrainingEnrollment(),
    new CVisionOnboardingOffboarding(),
    new CVisionQuickHire(),
    new CVisionEOSCalculation(),
  ];
}

async function main() {
  const overrides = parseArgs();
  const config = buildConfig(overrides);

  console.log('\n  ╔══════════════════════════════════════╗');
  console.log('  ║    THEA HOSPITAL SIMULATOR v1.0      ║');
  console.log('  ╚══════════════════════════════════════╝');

  const engine = new SimulationEngine(config);
  const scenarios = getAllScenarios();
  engine.registerScenarios(scenarios);

  if (config.modules.length > 0) {
    engine.filterModules(config.modules);
  }

  await engine.run();
}

main().catch((err) => {
  console.error('Simulator crashed:', err);
  process.exit(2);
});
