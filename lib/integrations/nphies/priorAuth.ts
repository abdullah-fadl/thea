// =============================================================================
// NPHIES Prior Authorization — Request, Check Status
// =============================================================================

import { getNphiesClient } from './client';
import {
  createPatientResource,
  createCoverageResource,
  extractDenialReasons,
} from './fhirResources';
import { withRetry } from './retry';
import { nphiesConfig } from './config';
import { logger } from '@/lib/monitoring/logger';
import { v4 as uuidv4 } from 'uuid';
import {
  type NphiesPriorAuthRequest,
  type NphiesPriorAuthResponse,
  type NphiesPriorAuthStatusRequest,
  type NphiesSendBundleResult,
  PriorAuthStatus,
  NPHIES_PROFILES,
  NPHIES_SYSTEMS,
} from './types';

// ---------------------------------------------------------------------------
// Request Prior Authorization
// ---------------------------------------------------------------------------

export async function requestPriorAuthorization(
  request: NphiesPriorAuthRequest,
): Promise<NphiesPriorAuthResponse> {
  nphiesConfig.validate();
  const client = getNphiesClient();

  const patientId = uuidv4();
  const patient = createPatientResource(patientId, request.patient);

  const coverageId = uuidv4();
  const coverage = createCoverageResource(coverageId, patientId, request.coverage);

  const claimId = uuidv4();
  const claim: any = {
    resourceType: 'Claim',
    id: claimId,
    meta: { profile: [NPHIES_PROFILES.PRIOR_AUTH_REQUEST] },
    status: 'active',
    type: {
      coding: [
        {
          system: NPHIES_SYSTEMS.CLAIM_TYPE,
          code: 'professional',
        },
      ],
    },
    use: 'preauthorization',
    patient: { reference: `Patient/${patientId}` },
    created: new Date().toISOString(),
    insurer: {
      type: 'Organization',
      identifier: {
        system: NPHIES_SYSTEMS.PAYER_LICENSE,
        value: request.coverage.insurerId,
      },
    },
    provider: {
      type: 'Organization',
      identifier: {
        system: NPHIES_SYSTEMS.PROVIDER_LICENSE,
        value: client.licenseId,
      },
    },
    priority: {
      coding: [{ system: NPHIES_SYSTEMS.PROCESS_PRIORITY, code: 'normal' }],
    },
    insurance: [
      {
        sequence: 1,
        focal: true,
        coverage: { reference: `Coverage/${coverageId}` },
      },
    ],
    diagnosis: request.diagnosis.map((diag, index) => ({
      sequence: index + 1,
      diagnosisCodeableConcept: {
        coding: [
          {
            system: NPHIES_SYSTEMS.ICD10,
            code: diag.code,
            display: diag.display,
          },
        ],
      },
      type: [
        {
          coding: [
            {
              system: NPHIES_SYSTEMS.DIAGNOSIS_TYPE,
              code: index === 0 ? 'principal' : 'secondary',
            },
          ],
        },
      ],
    })),
    item: request.services.map((service, index) => ({
      sequence: index + 1,
      productOrService: {
        coding: [
          {
            system: NPHIES_SYSTEMS.SCIENTIFIC_CODES,
            code: service.code,
            display: service.display,
          },
        ],
      },
      quantity: { value: service.quantity },
      unitPrice: { value: service.unitPrice, currency: 'SAR' },
      net: { value: service.quantity * service.unitPrice, currency: 'SAR' },
    })),
    total: {
      value: request.services.reduce((sum, s) => sum + s.quantity * s.unitPrice, 0),
      currency: 'SAR',
    },
  };

  // Add supporting info if provided
  if (request.supportingInfo?.length) {
    claim.supportingInfo = request.supportingInfo.map((info, index) => ({
      sequence: index + 1,
      category: {
        coding: [{ system: NPHIES_SYSTEMS.CLAIM_INFO_CATEGORY, code: info.category }],
      },
      code: {
        coding: [{ system: NPHIES_SYSTEMS.CLAIM_INFO_CODE, code: info.code }],
      },
      valueString: info.value,
    }));
  }

  // Link to encounter if provided
  if (request.encounterId) {
    for (const item of claim.item) {
      item.encounter = [{ reference: `Encounter/${request.encounterId}` }];
    }
  }

  const messageHeader = client.generateMessageHeader('priorauth-request', `Claim/${claimId}`);
  const bundle = client.createBundle('message', [messageHeader, patient, coverage, claim]);

  logger.info('NPHIES prior auth request started', {
    category: 'billing',
    patientNationalId: request.patient.nationalId,
    insurerId: request.coverage.insurerId,
    diagnosisCount: request.diagnosis.length,
    serviceCount: request.services.length,
    encounterId: request.encounterId,
  });

  const response = await withRetry(
    () => client.sendBundle(bundle),
    'prior-auth-request',
  );

  const result = parsePriorAuthResponse(response);

  logger.info('NPHIES prior auth request completed', {
    category: 'billing',
    patientNationalId: request.patient.nationalId,
    approved: result.approved,
    status: result.status,
    authorizationNumber: result.authorizationNumber,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Check Prior Auth Status
// ---------------------------------------------------------------------------

export async function checkPriorAuthStatus(
  request: NphiesPriorAuthStatusRequest,
): Promise<NphiesPriorAuthResponse> {
  nphiesConfig.validate();
  const client = getNphiesClient();

  const messageHeader = client.generateMessageHeader('status-check');
  const statusRequest = {
    resourceType: 'Task',
    id: uuidv4(),
    status: 'requested',
    intent: 'order',
    code: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/financialtaskcode', code: 'status' }],
    },
    focus: {
      identifier: {
        system: NPHIES_SYSTEMS.PROVIDER_LICENSE,
        value: request.authorizationNumber,
      },
    },
    requester: {
      type: 'Organization',
      identifier: {
        system: NPHIES_SYSTEMS.PROVIDER_LICENSE,
        value: client.licenseId,
      },
    },
    owner: {
      type: 'Organization',
      identifier: {
        system: NPHIES_SYSTEMS.PAYER_LICENSE,
        value: request.insurerId,
      },
    },
  };

  const bundle = client.createBundle('message', [messageHeader, statusRequest]);

  logger.info('NPHIES prior auth status check', {
    category: 'billing',
    authorizationNumber: request.authorizationNumber,
    insurerId: request.insurerId,
  });

  const response = await withRetry(
    () => client.sendBundle(bundle),
    'prior-auth-status',
  );

  return parsePriorAuthResponse(response);
}

// ---------------------------------------------------------------------------
// Response Parsing
// ---------------------------------------------------------------------------

function parsePriorAuthResponse(response: NphiesSendBundleResult): NphiesPriorAuthResponse {
  if (!response.success) {
    const errorMsg = extractErrorMessage(response.error);
    return {
      status: PriorAuthStatus.ERROR,
      approved: false,
      denialReason: errorMsg,
      denialReasonAr: 'فشل طلب الموافقة المسبقة',
      rawResponse: response,
    };
  }

  try {
    const bundle = response.data as any;
    const claimResponse = bundle?.entry?.find(
      (e: any) => e.resource?.resourceType === 'ClaimResponse',
    )?.resource;

    if (!claimResponse) {
      return {
        status: PriorAuthStatus.ERROR,
        approved: false,
        denialReason: 'No response received',
        denialReasonAr: 'لم يتم استلام رد',
        rawResponse: response,
      };
    }

    // Map outcome to PriorAuthStatus
    const priorAuthStatus = mapOutcomeToPriorAuthStatus(claimResponse.outcome);
    const approved = priorAuthStatus === PriorAuthStatus.APPROVED;

    // Parse denial reasons if not approved
    const denialReasons = !approved ? extractDenialReasons(claimResponse) : undefined;
    const primaryDenial = denialReasons?.[0];

    // Check if authorization has expired
    let status = priorAuthStatus;
    if (approved && claimResponse.preAuthPeriod?.end) {
      const expiryDate = new Date(claimResponse.preAuthPeriod.end);
      if (expiryDate < new Date()) {
        status = PriorAuthStatus.EXPIRED;
      }
    }

    return {
      status,
      approved,
      authorizationNumber: claimResponse.preAuthRef,
      approvedServices: claimResponse.item?.map((item: any) => ({
        code: item.productOrService?.coding?.[0]?.code,
        approvedQuantity: item.adjudication?.find(
          (a: any) => a.category?.coding?.[0]?.code === 'approved',
        )?.value ?? 0,
        approvedAmount: item.adjudication?.find(
          (a: any) => a.category?.coding?.[0]?.code === 'benefit',
        )?.amount?.value ?? 0,
      })),
      expiryDate: claimResponse.preAuthPeriod?.end,
      denialReasons,
      denialReason: primaryDenial?.display,
      denialReasonAr: primaryDenial?.displayAr,
      disposition: claimResponse.disposition,
      rawResponse: response,
    };
  } catch (err) {
    logger.error('NPHIES prior auth response parse error', {
      category: 'billing',
      error: err,
    });
    return {
      status: PriorAuthStatus.ERROR,
      approved: false,
      denialReason: 'Failed to parse response',
      denialReasonAr: 'فشل في تحليل الرد',
      rawResponse: response,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapOutcomeToPriorAuthStatus(outcome?: string): PriorAuthStatus {
  switch (outcome) {
    case 'complete':
      return PriorAuthStatus.APPROVED;
    case 'error':
      return PriorAuthStatus.DENIED;
    case 'partial':
      return PriorAuthStatus.PARTIAL;
    case 'queued':
      return PriorAuthStatus.PENDING;
    default:
      return PriorAuthStatus.ERROR;
  }
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as Error).message);
  }
  return 'Prior authorization request failed';
}
