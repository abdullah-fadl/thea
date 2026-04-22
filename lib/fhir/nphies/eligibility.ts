/**
 * NPHIES Eligibility Check
 *
 * Wraps the existing eligibility module with a cleaner interface
 * for the FHIR API layer.
 */

import { logger } from '@/lib/monitoring/logger';
import type { EligibilityCheckResult } from './types';

/**
 * Check patient insurance eligibility via NPHIES.
 */
export async function checkEligibility(params: {
  tenantId: string;
  patientId: string;
  nationalId: string;
  insurerId: string;
  memberId: string;
  serviceCategory?: string;
}): Promise<EligibilityCheckResult> {
  try {
    // Attempt to use existing NPHIES eligibility module
    const { checkEligibility: nphiesCheck } = await import('@/lib/integrations/nphies/eligibility');

    const response = await nphiesCheck({
      patient: {
        nationalId: params.nationalId,
        fullName: '',
        birthDate: '',
        gender: 'male',
      },
      coverage: {
        insurerId: params.insurerId,
        insurerName: '',
        memberId: params.memberId,
        policyNumber: '',
        relationToSubscriber: 'self',
        subscriberId: params.memberId,
        startDate: '',
      },
      serviceDate: new Date().toISOString().split('T')[0],
      serviceCategories: [params.serviceCategory || 'CONSULTATION'],
    });

    return {
      eligible: response.eligible,
      status: response.eligible ? 'ELIGIBLE' : 'INELIGIBLE',
      benefits: response.benefits?.map((b) => ({
        serviceCategory: b.serviceCategory,
        covered: b.covered,
        copay: b.copay,
        coinsurance: b.coinsurance,
        deductible: b.deductible,
        maxBenefit: b.maxBenefit,
      })),
      errors: response.errors,
      rawResponse: response as unknown as Record<string, unknown>,
    };
  } catch (error) {
    logger.error('NPHIES eligibility check failed', {
      category: 'api',
      error,
      tenantId: params.tenantId,
    });

    // Return mock/fallback in development
    if (process.env.NODE_ENV === 'development') {
      return buildMockEligibility(params.serviceCategory);
    }

    return {
      eligible: false,
      status: 'ERROR',
      errors: [error instanceof Error ? error.message : 'Eligibility check failed'],
    };
  }
}

function buildMockEligibility(serviceCategory?: string): EligibilityCheckResult {
  return {
    eligible: true,
    status: 'ELIGIBLE',
    benefits: [{
      serviceCategory: serviceCategory || 'CONSULTATION',
      covered: true,
      copay: 50,
      coinsurance: 20,
      deductible: 0,
      maxBenefit: 500000,
    }],
  };
}
