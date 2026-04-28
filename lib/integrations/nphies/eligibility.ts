// =============================================================================
// NPHIES Eligibility — Check & Bulk Check
// =============================================================================

import { getNphiesClient } from './client';
import { createPatientResource, createCoverageResource } from './fhirResources';
import { withRetry } from './retry';
import { nphiesConfig } from './config';
import { logger } from '@/lib/monitoring/logger';
import { v4 as uuidv4 } from 'uuid';
import {
  type NphiesEligibilityRequest,
  type NphiesEligibilityResponse,
  type NphiesBulkEligibilityRequest,
  type NphiesBulkEligibilityResponse,
  type BenefitDetail,
  type NphiesSendBundleResult,
  EligibilityStatus,
  NphiesError,
  NPHIES_PROFILES,
} from './types';

// ---------------------------------------------------------------------------
// Single Eligibility Check
// ---------------------------------------------------------------------------

export async function checkEligibility(
  request: NphiesEligibilityRequest,
): Promise<NphiesEligibilityResponse> {
  nphiesConfig.validate();
  const client = getNphiesClient();

  const patientId = uuidv4();
  const patient = createPatientResource(patientId, request.patient);

  const coverageId = uuidv4();
  const coverage = createCoverageResource(coverageId, patientId, request.coverage);

  const eligibilityRequestId = uuidv4();
  const eligibilityRequest = {
    resourceType: 'CoverageEligibilityRequest',
    id: eligibilityRequestId,
    meta: {
      profile: [NPHIES_PROFILES.ELIGIBILITY_REQUEST],
    },
    status: 'active',
    purpose: ['benefits', 'validation'],
    patient: { reference: `Patient/${patientId}` },
    servicedDate: request.serviceDate,
    created: new Date().toISOString(),
    insurer: {
      reference: `Organization/${request.coverage.insurerId}`,
    },
    provider: {
      type: 'Organization',
      identifier: {
        system: 'http://nphies.sa/license/provider-license',
        value: client.licenseId,
      },
    },
    insurance: [
      {
        focal: true,
        coverage: { reference: `Coverage/${coverageId}` },
      },
    ],
  };

  const messageHeader = client.generateMessageHeader(
    'eligibility-request',
    `CoverageEligibilityRequest/${eligibilityRequestId}`,
  );

  const bundle = client.createBundle('message', [
    messageHeader,
    patient,
    coverage,
    eligibilityRequest,
  ]);

  logger.info('NPHIES eligibility check started', {
    category: 'billing',
    patientNationalId: request.patient.nationalId,
    insurerId: request.coverage.insurerId,
    serviceDate: request.serviceDate,
  });

  const response = await withRetry(
    () => client.sendBundle(bundle),
    'eligibility-check',
  );

  const result = parseEligibilityResponse(response);

  logger.info('NPHIES eligibility check completed', {
    category: 'billing',
    patientNationalId: request.patient.nationalId,
    eligible: result.eligible,
    status: result.status,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Bulk Eligibility Check
// ---------------------------------------------------------------------------

export async function checkBulkEligibility(
  request: NphiesBulkEligibilityRequest,
): Promise<NphiesBulkEligibilityResponse> {
  const concurrency = Math.min(request.concurrency ?? 5, 10);
  const results: NphiesBulkEligibilityResponse['results'] = [];
  let totalEligible = 0;
  let totalIneligible = 0;
  let totalErrors = 0;

  logger.info('NPHIES bulk eligibility check started', {
    category: 'billing',
    totalRequests: request.requests.length,
    concurrency,
  });

  // Process in batches of `concurrency`
  for (let i = 0; i < request.requests.length; i += concurrency) {
    const batch = request.requests.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map((req) => checkEligibility(req)),
    );

    for (let j = 0; j < batchResults.length; j++) {
      const batchIndex = i + j;
      const settled = batchResults[j];

      if (settled.status === 'fulfilled') {
        const response = settled.value;
        results.push({
          index: batchIndex,
          patientNationalId: batch[j].patient.nationalId,
          response,
        });
        if (response.eligible) totalEligible++;
        else totalIneligible++;
      } else {
        totalErrors++;
        const errorMsg = settled.reason instanceof Error
          ? settled.reason.message
          : String(settled.reason);
        results.push({
          index: batchIndex,
          patientNationalId: batch[j].patient.nationalId,
          response: {
            status: EligibilityStatus.ERROR,
            eligible: false,
            coverageActive: false,
            errors: [errorMsg],
            errorsAr: ['فشل التحقق من الأهلية'],
          },
        });
      }
    }
  }

  logger.info('NPHIES bulk eligibility check completed', {
    category: 'billing',
    totalProcessed: results.length,
    totalEligible,
    totalIneligible,
    totalErrors,
  });

  return {
    results,
    totalProcessed: results.length,
    totalEligible,
    totalIneligible,
    totalErrors,
  };
}

// ---------------------------------------------------------------------------
// Response Parsing
// ---------------------------------------------------------------------------

function parseEligibilityResponse(response: NphiesSendBundleResult): NphiesEligibilityResponse {
  if (!response.success) {
    const errorMsg = extractErrorMessage(response.error);
    return {
      status: EligibilityStatus.ERROR,
      eligible: false,
      coverageActive: false,
      errors: [errorMsg],
      errorsAr: ['فشل الاتصال بخادم التأمين'],
      rawResponse: response,
    };
  }

  try {
    const bundle = response.data as any;
    const eligibilityResponse = bundle?.entry?.find(
      (e: any) => e.resource?.resourceType === 'CoverageEligibilityResponse',
    )?.resource;

    if (!eligibilityResponse) {
      return {
        status: EligibilityStatus.ERROR,
        eligible: false,
        coverageActive: false,
        errors: ['No eligibility response in bundle'],
        errorsAr: ['لم يتم استلام رد الأهلية'],
        rawResponse: response,
      };
    }

    // Handle error outcome
    if (eligibilityResponse.outcome === 'error') {
      const errors = extractResponseErrors(eligibilityResponse);
      return {
        status: EligibilityStatus.ERROR,
        eligible: false,
        coverageActive: false,
        errors: errors.en,
        errorsAr: errors.ar,
        disposition: eligibilityResponse.disposition,
        rawResponse: response,
      };
    }

    // Handle pending/queued outcome
    if (eligibilityResponse.outcome === 'queued') {
      return {
        status: EligibilityStatus.PENDING,
        eligible: false,
        coverageActive: false,
        disposition: eligibilityResponse.disposition,
        rawResponse: response,
      };
    }

    // Parse insurance and benefits
    const insurance = eligibilityResponse.insurance?.[0];
    const isActive = insurance?.inforce === true;
    const isEligible = eligibilityResponse.outcome === 'complete' && isActive;

    // Parse benefit details by service category
    const benefits = parseBenefitItems(insurance?.item);

    // Extract summary amounts from the first benefit (backward compat)
    const firstBenefit = insurance?.item?.[0]?.benefit?.[0];
    const copayBenefit = insurance?.item?.find(
      (item: any) => item.benefit?.some((b: any) =>
        b.type?.coding?.[0]?.code === 'copay',
      ),
    )?.benefit?.find((b: any) => b.type?.coding?.[0]?.code === 'copay');

    const deductibleBenefit = insurance?.item?.find(
      (item: any) => item.benefit?.some((b: any) =>
        b.type?.coding?.[0]?.code === 'deductible',
      ),
    )?.benefit?.find((b: any) => b.type?.coding?.[0]?.code === 'deductible');

    return {
      status: isEligible ? EligibilityStatus.ELIGIBLE : EligibilityStatus.INELIGIBLE,
      eligible: isEligible,
      coverageActive: isActive,
      benefitPeriod: insurance?.benefitPeriod,
      copay: copayBenefit?.allowedMoney?.value ?? firstBenefit?.allowedMoney?.value,
      deductible: deductibleBenefit?.allowedMoney?.value,
      maxBenefit: firstBenefit?.allowedMoney?.value,
      usedBenefit: firstBenefit?.usedMoney?.value,
      remainingBenefit:
        firstBenefit?.allowedMoney?.value != null && firstBenefit?.usedMoney?.value != null
          ? firstBenefit.allowedMoney.value - firstBenefit.usedMoney.value
          : undefined,
      benefits,
      disposition: eligibilityResponse.disposition,
      rawResponse: response,
    };
  } catch (err) {
    logger.error('NPHIES eligibility response parse error', {
      category: 'billing',
      error: err,
    });
    return {
      status: EligibilityStatus.ERROR,
      eligible: false,
      coverageActive: false,
      errors: ['Failed to parse eligibility response'],
      errorsAr: ['فشل في تحليل رد الأهلية'],
      rawResponse: response,
    };
  }
}

// ---------------------------------------------------------------------------
// Benefit Parsing Helpers
// ---------------------------------------------------------------------------

function parseBenefitItems(items: any[] | undefined): BenefitDetail[] {
  if (!Array.isArray(items)) return [];

  return items.map((item: any) => {
    const categoryCode = item.category?.coding?.[0]?.code || 'general';
    const categoryDisplay = item.category?.coding?.[0]?.display || item.name || categoryCode;

    const benefits = item.benefit || [];
    let copay: number | undefined;
    let coinsurance: number | undefined;
    let deductible: number | undefined;
    let maxBenefit: number | undefined;
    let usedBenefit: number | undefined;
    let remainingBenefit: number | undefined;

    for (const b of benefits) {
      const typeCode = b.type?.coding?.[0]?.code;
      switch (typeCode) {
        case 'copay':
          copay = b.allowedMoney?.value;
          break;
        case 'coinsurance':
          coinsurance = b.allowedUnsignedInt ?? b.allowedMoney?.value;
          break;
        case 'deductible':
          deductible = b.allowedMoney?.value;
          break;
        case 'benefit':
        default:
          maxBenefit = b.allowedMoney?.value;
          usedBenefit = b.usedMoney?.value;
          if (maxBenefit != null && usedBenefit != null) {
            remainingBenefit = maxBenefit - usedBenefit;
          }
          break;
      }
    }

    return {
      serviceCategory: categoryCode,
      serviceCategoryDisplay: categoryDisplay,
      covered: !item.excluded,
      copay,
      coinsurance,
      deductible,
      maxBenefit,
      usedBenefit,
      remainingBenefit,
      authorizationRequired: item.authorizationRequired ?? false,
      excluded: item.excluded ?? false,
      notes: item.description,
    };
  });
}

// ---------------------------------------------------------------------------
// Error Extraction Helpers
// ---------------------------------------------------------------------------

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as Error).message);
  }
  return 'Unknown error';
}

function extractResponseErrors(
  eligibilityResponse: any,
): { en: string[]; ar: string[] } {
  const en: string[] = [];
  const ar: string[] = [];

  const errors = eligibilityResponse.error;
  if (Array.isArray(errors)) {
    for (const err of errors) {
      const coding = err?.code?.coding?.[0];
      en.push(coding?.display || coding?.code || 'Unknown error');
      ar.push(coding?.display || 'خطأ غير معروف');
    }
  }

  if (en.length === 0) {
    en.push('Eligibility check failed');
    ar.push('فشل التحقق من الأهلية');
  }

  return { en, ar };
}
