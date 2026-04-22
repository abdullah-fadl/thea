// =============================================================================
// NPHIES Claims — Submit, Resubmit, Status
// =============================================================================

import { getNphiesClient } from './client';
import {
  createPatientResource,
  createCoverageResource,
  extractDenialReasons,
  mapEncounterType,
} from './fhirResources';
import { withRetry } from './retry';
import { nphiesConfig } from './config';
import { logger } from '@/lib/monitoring/logger';
import { v4 as uuidv4 } from 'uuid';
import {
  type NphiesClaimRequest,
  type NphiesClaimResponse,
  type NphiesResubmitClaimRequest,
  type NphiesClaimStatusRequest,
  type NphiesSendBundleResult,
  type AdjudicationDetail,
  ClaimStatus,
  NPHIES_PROFILES,
  NPHIES_SYSTEMS,
} from './types';

// ---------------------------------------------------------------------------
// Submit Claim
// ---------------------------------------------------------------------------

export async function submitClaim(
  request: NphiesClaimRequest,
): Promise<NphiesClaimResponse> {
  nphiesConfig.validate();
  const client = getNphiesClient();

  const patientId = uuidv4();
  const patient = createPatientResource(patientId, request.patient);

  const coverageId = uuidv4();
  const coverage = createCoverageResource(coverageId, patientId, request.coverage);

  const encounterId = uuidv4();
  const encounter = {
    resourceType: 'Encounter',
    id: encounterId,
    meta: { profile: [NPHIES_PROFILES.ENCOUNTER] },
    status: 'finished',
    class: {
      system: NPHIES_SYSTEMS.ACT_CODE,
      code: mapEncounterType(request.encounter.type),
    },
    subject: { reference: `Patient/${patientId}` },
    period: {
      start: request.encounter.startDate,
      end: request.encounter.endDate || request.encounter.startDate,
    },
    serviceProvider: {
      type: 'Organization',
      identifier: {
        system: NPHIES_SYSTEMS.PROVIDER_LICENSE,
        value: client.licenseId,
      },
    },
  };

  const claimId = uuidv4();
  const claim = buildClaimResource(claimId, patientId, coverageId, encounterId, request, client);

  const messageHeader = client.generateMessageHeader('claim-request', `Claim/${claimId}`);
  const bundle = client.createBundle('message', [
    messageHeader,
    patient,
    coverage,
    encounter,
    claim,
  ]);

  logger.info('NPHIES claim submission started', {
    category: 'billing',
    patientNationalId: request.patient.nationalId,
    insurerId: request.coverage.insurerId,
    totalAmount: request.totalAmount,
    serviceCount: request.services.length,
  });

  const response = await withRetry(
    () => client.sendBundle(bundle),
    'claim-submit',
  );

  const result = parseClaimResponse(response);

  logger.info('NPHIES claim submission completed', {
    category: 'billing',
    patientNationalId: request.patient.nationalId,
    accepted: result.accepted,
    status: result.status,
    claimId: result.claimId,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Resubmit Claim
// ---------------------------------------------------------------------------

export async function resubmitClaim(
  request: NphiesResubmitClaimRequest,
): Promise<NphiesClaimResponse> {
  nphiesConfig.validate();
  const client = getNphiesClient();

  const patientId = uuidv4();
  const patient = createPatientResource(patientId, request.patient);

  const coverageId = uuidv4();
  const coverage = createCoverageResource(coverageId, patientId, request.coverage);

  const encounterId = uuidv4();
  const encounter = {
    resourceType: 'Encounter',
    id: encounterId,
    meta: { profile: [NPHIES_PROFILES.ENCOUNTER] },
    status: 'finished',
    class: {
      system: NPHIES_SYSTEMS.ACT_CODE,
      code: mapEncounterType(request.encounter.type),
    },
    subject: { reference: `Patient/${patientId}` },
    period: {
      start: request.encounter.startDate,
      end: request.encounter.endDate || request.encounter.startDate,
    },
    serviceProvider: {
      type: 'Organization',
      identifier: {
        system: NPHIES_SYSTEMS.PROVIDER_LICENSE,
        value: client.licenseId,
      },
    },
  };

  const claimId = uuidv4();
  const claim: any = buildClaimResource(claimId, patientId, coverageId, encounterId, request, client);

  // Mark as a resubmission with reference to original
  claim.related = [
    {
      claim: {
        identifier: {
          system: NPHIES_SYSTEMS.PROVIDER_LICENSE,
          value: request.originalClaimReference,
        },
      },
      relationship: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/ex-relatedclaimrelationship', code: 'prior' }],
      },
    },
  ];

  // Add resubmission reason as supporting info
  if (!claim.supportingInfo) claim.supportingInfo = [];
  claim.supportingInfo.push({
    sequence: (claim.supportingInfo.length || 0) + 1,
    category: {
      coding: [{ system: NPHIES_SYSTEMS.CLAIM_INFO_CATEGORY, code: 'info' }],
    },
    valueString: request.resubmissionReason,
  });

  const messageHeader = client.generateMessageHeader('claim-request', `Claim/${claimId}`);
  const bundle = client.createBundle('message', [
    messageHeader,
    patient,
    coverage,
    encounter,
    claim,
  ]);

  logger.info('NPHIES claim resubmission started', {
    category: 'billing',
    originalClaimReference: request.originalClaimReference,
    resubmissionReason: request.resubmissionReason,
  });

  const response = await withRetry(
    () => client.sendBundle(bundle),
    'claim-resubmit',
  );

  const result = parseClaimResponse(response);

  logger.info('NPHIES claim resubmission completed', {
    category: 'billing',
    accepted: result.accepted,
    status: result.status,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Check Claim Status
// ---------------------------------------------------------------------------

export async function checkClaimStatus(
  request: NphiesClaimStatusRequest,
): Promise<NphiesClaimResponse> {
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
        value: request.claimReference,
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

  logger.info('NPHIES claim status check', {
    category: 'billing',
    claimReference: request.claimReference,
    insurerId: request.insurerId,
  });

  const response = await withRetry(
    () => client.sendBundle(bundle),
    'claim-status',
  );

  return parseClaimResponse(response);
}

// ---------------------------------------------------------------------------
// Claim Resource Builder
// ---------------------------------------------------------------------------

function buildClaimResource(
  claimId: string,
  patientId: string,
  coverageId: string,
  encounterId: string,
  request: NphiesClaimRequest,
  client: ReturnType<typeof getNphiesClient>,
): object {
  return {
    resourceType: 'Claim',
    id: claimId,
    meta: { profile: [NPHIES_PROFILES.CLAIM] },
    status: 'active',
    type: {
      coding: [
        {
          system: NPHIES_SYSTEMS.CLAIM_TYPE,
          code: request.encounter.type === 'outpatient' ? 'professional' : 'institutional',
        },
      ],
    },
    use: 'claim',
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
              code: diag.type,
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
      servicedDate: service.date,
      quantity: { value: service.quantity },
      unitPrice: { value: service.unitPrice, currency: 'SAR' },
      net: { value: service.totalPrice, currency: 'SAR' },
      encounter: [{ reference: `Encounter/${encounterId}` }],
      ...(service.priorAuthNumber && {
        extension: [
          {
            url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-priorauth-reference',
            valueString: service.priorAuthNumber,
          },
        ],
      }),
    })),
    total: { value: request.totalAmount, currency: 'SAR' },
  };
}

// ---------------------------------------------------------------------------
// Response Parsing
// ---------------------------------------------------------------------------

function parseClaimResponse(response: NphiesSendBundleResult): NphiesClaimResponse {
  if (!response.success) {
    const errorMsg = extractErrorMessage(response.error);
    return {
      status: ClaimStatus.ERROR,
      accepted: false,
      errors: [errorMsg],
      errorsAr: ['فشل إرسال المطالبة'],
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
        status: ClaimStatus.ERROR,
        accepted: false,
        errors: ['No claim response received'],
        errorsAr: ['لم يتم استلام رد المطالبة'],
        rawResponse: response,
      };
    }

    // Map outcome to ClaimStatus
    const claimStatus = mapOutcomeToClaimStatus(claimResponse.outcome);
    const accepted = claimStatus === ClaimStatus.ACCEPTED;

    // Parse totals
    const totals = claimResponse.total || [];
    const payerAmount = totals.find(
      (t: any) => t.category?.coding?.[0]?.code === 'benefit',
    )?.amount?.value;
    const patientAmount = totals.find(
      (t: any) => t.category?.coding?.[0]?.code === 'copay',
    )?.amount?.value;

    // Parse adjudication details from items
    const adjudicationDetails = parseAdjudicationDetails(claimResponse.item);

    // Parse denial reasons
    const denialReasons = !accepted ? extractDenialReasons(claimResponse) : undefined;
    const primaryDenial = denialReasons?.[0];

    return {
      status: claimStatus,
      accepted,
      claimId: claimResponse.id,
      claimReference: claimResponse.identifier?.[0]?.value,
      adjudicatedAmount: claimResponse.payment?.amount?.value,
      payerAmount,
      patientResponsibility: patientAmount,
      adjudicationDetails,
      denialReasons,
      denialReason: primaryDenial?.display,
      denialReasonAr: primaryDenial?.displayAr,
      disposition: claimResponse.disposition,
      rawResponse: response,
    };
  } catch (err) {
    logger.error('NPHIES claim response parse error', {
      category: 'billing',
      error: err,
    });
    return {
      status: ClaimStatus.ERROR,
      accepted: false,
      errors: ['Failed to parse claim response'],
      errorsAr: ['فشل في تحليل رد المطالبة'],
      rawResponse: response,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapOutcomeToClaimStatus(outcome?: string): ClaimStatus {
  switch (outcome) {
    case 'complete':
      return ClaimStatus.ACCEPTED;
    case 'error':
      return ClaimStatus.REJECTED;
    case 'partial':
      return ClaimStatus.PARTIAL;
    case 'queued':
      return ClaimStatus.PENDING;
    default:
      return ClaimStatus.ERROR;
  }
}

function parseAdjudicationDetails(items: any[] | undefined): AdjudicationDetail[] {
  if (!Array.isArray(items)) return [];

  const details: AdjudicationDetail[] = [];
  for (const item of items) {
    const adjudications = item?.adjudication;
    if (!Array.isArray(adjudications)) continue;
    for (const adj of adjudications) {
      details.push({
        category: adj.category,
        reason: adj.reason,
        amount: adj.amount,
        value: adj.value,
      });
    }
  }
  return details;
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as Error).message);
  }
  return 'Claim submission failed';
}
