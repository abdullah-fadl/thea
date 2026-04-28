/**
 * NPHIES Prior Authorization
 *
 * Wraps the existing prior auth module with a cleaner interface
 * for the FHIR API layer.
 */

import { logger } from '@/lib/monitoring/logger';
import type { PreauthResult } from './types';

/**
 * Request prior authorization via NPHIES.
 */
export async function requestPriorAuth(params: {
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
  encounterId?: string;
  diagnosis: Array<{ code: string; display: string }>;
  services: Array<{
    code: string;
    display: string;
    quantity: number;
    unitPrice: number;
  }>;
  supportingInfo?: Array<{
    category: string;
    code: string;
    value: string;
  }>;
}): Promise<PreauthResult> {
  try {
    const { requestPriorAuthorization } = await import(
      '@/lib/integrations/nphies/priorAuth'
    );

    const response = await requestPriorAuthorization({
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
      encounterId: params.encounterId,
      diagnosis: params.diagnosis,
      services: params.services,
      supportingInfo: params.supportingInfo,
    });

    return {
      approved: response.approved,
      status: response.status,
      authorizationNumber: response.authorizationNumber,
      expiryDate: response.expiryDate,
      approvedServices: response.approvedServices?.map((s) => ({
        serviceCode: s.code,
        approved: true,
        approvedQuantity: s.approvedQuantity,
        approvedAmount: s.approvedAmount,
      })),
      denialReasons: response.denialReasons?.map((r) => r.display || r.code),
      errors: response.disposition ? [response.disposition] : undefined,
      rawResponse: response as unknown as Record<string, unknown>,
    };
  } catch (error) {
    logger.error('NPHIES prior auth request failed', {
      category: 'api',
      error,
      tenantId: params.tenantId,
    });

    // Return mock in development
    if (process.env.NODE_ENV === 'development') {
      return buildMockPreauth(params.services);
    }

    return {
      approved: false,
      status: 'ERROR',
      errors: [
        error instanceof Error
          ? error.message
          : 'Prior authorization request failed',
      ],
    };
  }
}

/**
 * Check status of a prior authorization.
 */
export async function checkPreauthStatus(params: {
  tenantId: string;
  authorizationNumber: string;
  insurerId: string;
}): Promise<PreauthResult> {
  try {
    const { checkPriorAuthStatus } = await import(
      '@/lib/integrations/nphies/priorAuth'
    );

    const response = await checkPriorAuthStatus({
      authorizationNumber: params.authorizationNumber,
      insurerId: params.insurerId,
    });

    return {
      approved: response.approved,
      status: response.status,
      authorizationNumber: response.authorizationNumber,
      expiryDate: response.expiryDate,
      approvedServices: response.approvedServices?.map((s) => ({
        serviceCode: s.code,
        approved: true,
        approvedQuantity: s.approvedQuantity,
        approvedAmount: s.approvedAmount,
      })),
      denialReasons: response.denialReasons?.map((r) => r.display || r.code),
      rawResponse: response as unknown as Record<string, unknown>,
    };
  } catch (error) {
    logger.error('NPHIES prior auth status check failed', {
      category: 'api',
      error,
      tenantId: params.tenantId,
    });

    return {
      approved: false,
      status: 'ERROR',
      errors: [
        error instanceof Error
          ? error.message
          : 'Prior auth status check failed',
      ],
    };
  }
}

function buildMockPreauth(
  services: Array<{ code: string; display: string; quantity: number; unitPrice: number }>,
): PreauthResult {
  return {
    approved: true,
    status: 'APPROVED',
    authorizationNumber: `MOCK-PA-${Date.now()}`,
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    approvedServices: services.map((s) => ({
      serviceCode: s.code,
      approved: true,
      approvedQuantity: s.quantity,
      approvedAmount: s.unitPrice * s.quantity,
    })),
  };
}
