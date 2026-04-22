/**
 * NPHIES Integration Types
 *
 * Re-exports and extends the existing NPHIES types from lib/integrations/nphies/
 * for use in the new FHIR server layer.
 */

// Re-export existing types
export type {
  NphiesPatient,
  NphiesCoverage,
  NphiesEligibilityRequest,
  NphiesEligibilityResponse,
  NphiesPriorAuthRequest,
  NphiesPriorAuthResponse,
  NphiesClaimRequest,
  NphiesClaimResponse,
  BenefitDetail,
  AdjudicationDetail,
  DenialReason,
} from '@/lib/integrations/nphies/types';

// ---------------------------------------------------------------------------
// Extended Types for FHIR Layer
// ---------------------------------------------------------------------------

export interface NphiesConfig {
  baseUrl: string;
  providerId: string;
  providerLicense: string;
  facilityId: string;
  clientId?: string;
  clientSecret?: string;
  environment: 'sandbox' | 'production';
}

export interface EligibilityCheckResult {
  eligible: boolean;
  status: string;
  benefits?: {
    serviceCategory: string;
    covered: boolean;
    copay?: number;
    coinsurance?: number;
    deductible?: number;
    maxBenefit?: number;
  }[];
  errors?: string[];
  rawResponse?: Record<string, unknown>;
}

export interface PreauthResult {
  approved: boolean;
  status: string;
  authorizationNumber?: string;
  expiryDate?: string;
  approvedServices?: {
    code?: string;
    serviceCode?: string;
    approved?: boolean;
    approvedQuantity?: number;
    approvedAmount?: number;
  }[];
  denialReasons?: Array<string | { code: string; display: string; displayAr: string }>;
  errors?: string[];
  rawResponse?: Record<string, unknown>;
}

export interface ClaimSubmissionResult {
  accepted: boolean;
  status: string;
  claimId?: string;
  claimReference?: string;
  adjudicatedAmount?: number;
  patientResponsibility?: number;
  payerAmount?: number;
  adjudicationDetails?: Array<{
    serviceCode?: string;
    submittedAmount?: number;
    approvedAmount?: number;
    denialReason?: string;
  }>;
  denialReasons?: Array<string | { code: string; display: string; displayAr: string }>;
  errors?: string[];
  rawResponse?: Record<string, unknown>;
}
