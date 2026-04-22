/**
 * NPHIES Integration — FHIR Layer
 *
 * Re-exports all NPHIES wrapper functions and types
 * used by the FHIR API routes.
 */

export { checkEligibility } from './eligibility';
export { requestPriorAuth, checkPreauthStatus } from './preauth';
export { submitClaim, checkClaimStatus, resubmitClaim } from './claim';
export type {
  EligibilityCheckResult,
  PreauthResult,
  ClaimSubmissionResult,
} from './types';
