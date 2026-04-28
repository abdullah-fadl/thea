/**
 * NPHIES Claims
 *
 * Wraps the existing claims module with a cleaner interface
 * for the FHIR API layer.
 */

import { logger } from '@/lib/monitoring/logger';
import type { ClaimSubmissionResult } from './types';

/**
 * Submit a claim to NPHIES.
 */
export async function submitClaim(params: {
  tenantId: string;
  patientId: string;
  nationalId: string;
  fullName: string;
  birthDate: string;
  gender: string;
  insurerId: string;
  insurerName: string;
  memberId: string;
  policyNumber: string;
  encounter: {
    id: string;
    type: 'outpatient' | 'inpatient' | 'emergency';
    startDate: string;
    endDate?: string;
    provider: { id: string; name: string; specialty?: string };
  };
  diagnosis: Array<{ code: string; display: string; type: string }>;
  services: Array<{
    code: string;
    display: string;
    date: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    priorAuthNumber?: string;
  }>;
  totalAmount: number;
}): Promise<ClaimSubmissionResult> {
  try {
    const { submitClaim: nphiesSubmit } = await import(
      '@/lib/integrations/nphies/claims'
    );

    const response = await nphiesSubmit({
      patient: {
        nationalId: params.nationalId,
        fullName: params.fullName,
        birthDate: params.birthDate,
        gender: params.gender as 'male' | 'female',
      },
      coverage: {
        insurerId: params.insurerId,
        insurerName: params.insurerName,
        memberId: params.memberId,
        policyNumber: params.policyNumber,
        relationToSubscriber: 'self',
        subscriberId: params.memberId,
        startDate: '',
      },
      encounter: {
        ...params.encounter,
        provider: {
          ...params.encounter.provider,
          specialty: params.encounter.provider.specialty || '',
        },
      },
      diagnosis: params.diagnosis.map((d) => ({
        code: d.code,
        display: d.display,
        type: d.type as 'principal' | 'secondary',
      })),
      services: params.services,
      totalAmount: params.totalAmount,
    });

    return {
      accepted: response.accepted,
      status: response.status,
      claimId: response.claimId,
      claimReference: response.claimReference,
      adjudicatedAmount: response.adjudicatedAmount,
      patientResponsibility: response.patientResponsibility,
      payerAmount: response.payerAmount,
      denialReasons: response.denialReasons?.map((r) => r.display || r.code),
      errors: response.errors,
      rawResponse: response as unknown as Record<string, unknown>,
    };
  } catch (error) {
    logger.error('NPHIES claim submission failed', {
      category: 'api',
      error,
      tenantId: params.tenantId,
    });

    if (process.env.NODE_ENV === 'development') {
      return buildMockClaimResult(params.totalAmount);
    }

    return {
      accepted: false,
      status: 'ERROR',
      errors: [
        error instanceof Error ? error.message : 'Claim submission failed',
      ],
    };
  }
}

/**
 * Check status of a submitted claim.
 */
export async function checkClaimStatus(params: {
  tenantId: string;
  claimId: string;
  insurerId: string;
}): Promise<ClaimSubmissionResult> {
  try {
    const { checkClaimStatus: nphiesCheck } = await import(
      '@/lib/integrations/nphies/claims'
    );

    const response = await nphiesCheck({
      claimReference: params.claimId,
      insurerId: params.insurerId,
    });

    return {
      accepted: response.accepted,
      status: response.status,
      claimId: response.claimId,
      claimReference: response.claimReference,
      adjudicatedAmount: response.adjudicatedAmount,
      patientResponsibility: response.patientResponsibility,
      payerAmount: response.payerAmount,
      denialReasons: response.denialReasons?.map((r) => r.display || r.code),
      rawResponse: response as unknown as Record<string, unknown>,
    };
  } catch (error) {
    logger.error('NPHIES claim status check failed', {
      category: 'api',
      error,
      tenantId: params.tenantId,
    });

    return {
      accepted: false,
      status: 'ERROR',
      errors: [
        error instanceof Error
          ? error.message
          : 'Claim status check failed',
      ],
    };
  }
}

/**
 * Resubmit a previously rejected claim.
 */
export async function resubmitClaim(params: {
  tenantId: string;
  originalClaimId: string;
  insurerId: string;
  corrections: Record<string, unknown>;
}): Promise<ClaimSubmissionResult> {
  try {
    const { resubmitClaim: nphiesResubmit } = await import(
      '@/lib/integrations/nphies/claims'
    );

    // The NPHIES resubmit extends NphiesClaimRequest with extra fields.
    // We need to provide the full claim request shape + original reference.
    const resubmitPayload = {
      ...params.corrections,
      originalClaimReference: params.originalClaimId,
      resubmissionReason: (params.corrections.reason as string) || 'Corrected submission',
      // Provide minimal required fields if not in corrections
      patient: params.corrections.patient || {
        nationalId: '',
        fullName: '',
        birthDate: '',
        gender: 'male' as const,
      },
      coverage: params.corrections.coverage || {
        insurerId: params.insurerId,
        insurerName: '',
        memberId: '',
        policyNumber: '',
        relationToSubscriber: 'self' as const,
        subscriberId: '',
        startDate: '',
      },
      encounter: params.corrections.encounter || {
        id: '',
        type: 'outpatient' as const,
        startDate: '',
        provider: { id: '', name: '', specialty: '' },
      },
      diagnosis: params.corrections.diagnosis || [],
      services: params.corrections.services || [],
      totalAmount: (params.corrections.totalAmount as number) || 0,
    };

    const response = await nphiesResubmit(resubmitPayload as Parameters<typeof nphiesResubmit>[0]);

    return {
      accepted: response.accepted,
      status: response.status,
      claimId: response.claimId,
      claimReference: response.claimReference,
      adjudicatedAmount: response.adjudicatedAmount,
      patientResponsibility: response.patientResponsibility,
      payerAmount: response.payerAmount,
      errors: response.errors,
      rawResponse: response as unknown as Record<string, unknown>,
    };
  } catch (error) {
    logger.error('NPHIES claim resubmission failed', {
      category: 'api',
      error,
      tenantId: params.tenantId,
    });

    return {
      accepted: false,
      status: 'ERROR',
      errors: [
        error instanceof Error
          ? error.message
          : 'Claim resubmission failed',
      ],
    };
  }
}

function buildMockClaimResult(totalAmount: number): ClaimSubmissionResult {
  return {
    accepted: true,
    status: 'ACCEPTED',
    claimId: `MOCK-CLM-${Date.now()}`,
    claimReference: `REF-${Date.now()}`,
    adjudicatedAmount: totalAmount,
    patientResponsibility: totalAmount * 0.2,
    payerAmount: totalAmount * 0.8,
  };
}
