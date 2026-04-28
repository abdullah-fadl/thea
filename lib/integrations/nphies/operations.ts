// Phase 8.1.4 — High-level NPHIES operations.
//
// Two thin wrappers that compose the 8.1.1/8.1.2/8.1.3 pieces into a single
// "ship the message" call:
//
//   1. Load the canonical row (NphiesEligibilityLog or BillingClaim).
//   2. Serialize it to the appropriate FHIR resource.
//   3. Wrap it in a NPHIES message-mode Bundle (`buildNphiesMessageBundle`).
//   4. Send via `sendNphiesMessage` (flag-gated transport).
//   5. Persist the response Bundle into the existing log table.
//
// Both operations are flag-gated end-to-end — when FF_NPHIES_HTTP_ENABLED
// is OFF, sendNphiesMessage returns a synthetic mock response and we still
// persist that mock so the audit trail is uniform.

import { logger } from '@/lib/monitoring/logger';
import { prisma } from '@/lib/db/prisma';
import type { FhirResource } from '@/lib/fhir/types';
import { buildNphiesMessageBundle } from '@/lib/fhir/bundleBuilder';
import { NPHIES_EVENTS } from '@/lib/fhir/nphies-events';
import { serializeCoverageEligibilityRequest } from '@/lib/fhir/serializers/coverageEligibilityRequest';
import { serializeClaim } from '@/lib/fhir/serializers/claim';
import { sendNphiesMessage, type NphiesResponse } from './adapter';

const SENDER_ORG_ID   = 'thea-provider';
const RECEIVER_ORG_ID = 'nphies-hub';

// ---------------------------------------------------------------------------
// sendEligibilityCheck
// ---------------------------------------------------------------------------

export interface SendEligibilityArgs {
  /** NphiesEligibilityLog id whose request bundle should be sent. */
  eligibilityRequestId: string;
  /** Tenant performing the check (used for log-table scoping + audit). */
  tenantId: string;
}

export async function sendEligibilityCheck(
  args: SendEligibilityArgs,
): Promise<NphiesResponse> {
  const { eligibilityRequestId, tenantId } = args;

  const log = await prisma.nphiesEligibilityLog.findFirst({
    where: { id: eligibilityRequestId, tenantId },
  });
  if (!log) {
    throw new Error(`NphiesEligibilityLog not found: ${eligibilityRequestId} (tenant=${tenantId})`);
  }

  const eligibilityRequest = serializeCoverageEligibilityRequest(log, tenantId);

  const { bundle } = buildNphiesMessageBundle({
    eventCoding:    NPHIES_EVENTS.ELIGIBILITY,
    senderOrgId:    SENDER_ORG_ID,
    receiverOrgId:  RECEIVER_ORG_ID,
    focalResource:  eligibilityRequest as FhirResource,
    tenantId,
  });

  const response = await sendNphiesMessage({ bundle, tenantId });

  // Persist response on the same log row — preserves the request payload
  // under `response.request` while writing the gateway outcome under
  // `response.gatewayResponse`. We avoid clobbering the original eligibility
  // result snapshot the existing checkEligibility flow may have written.
  const existing = (log.response ?? {}) as Record<string, unknown>;
  await prisma.nphiesEligibilityLog.update({
    where: { id: log.id },
    data: {
      response: {
        ...existing,
        gatewayResponse: response.bundle as unknown as Record<string, unknown>,
        gatewayHttpStatus: response.httpStatus,
        gatewayCorrelationId: response.correlationId,
        gatewayElapsedMs: response.elapsedMs,
        gatewaySentAt: new Date().toISOString(),
        // Phase 8.1.5 — validation summary persisted alongside the response.
        validationIssueCount: response.validationIssueCount,
        validationFailed:     response.validationFailed,
      } as never,
    },
  });

  logger.info('NPHIES eligibility check sent + persisted', {
    category: 'integration' as const,
    subsystem: 'nphies.http',
    tenantId,
    eligibilityRequestId,
    correlationId: response.correlationId,
    httpStatus: response.httpStatus,
  });

  return response;
}

// ---------------------------------------------------------------------------
// sendClaim
// ---------------------------------------------------------------------------

export interface SendClaimArgs {
  /** BillingClaim id whose claim bundle should be sent. */
  claimId:  string;
  tenantId: string;
}

export async function sendClaim(args: SendClaimArgs): Promise<NphiesResponse> {
  const { claimId, tenantId } = args;

  const billingClaim = await prisma.billingClaim.findFirst({
    where: { id: claimId, tenantId },
  });
  if (!billingClaim) {
    throw new Error(`BillingClaim not found: ${claimId} (tenant=${tenantId})`);
  }

  const claim = await serializeClaim(billingClaim, tenantId);

  const { bundle } = buildNphiesMessageBundle({
    eventCoding:    NPHIES_EVENTS.CLAIM,
    senderOrgId:    SENDER_ORG_ID,
    receiverOrgId:  RECEIVER_ORG_ID,
    focalResource:  claim as FhirResource,
    tenantId,
  });

  const response = await sendNphiesMessage({ bundle, tenantId });

  // The canonical response side is NphiesClaim — write a new row per
  // submission rather than mutating an existing one. encounterCoreId on the
  // BillingClaim is `db.Uuid`; NphiesClaim.encounterId is plain text.
  await prisma.nphiesClaim.create({
    data: {
      tenantId,
      patientId:   (billingClaim.patient as { id?: string } | null)?.id ?? '',
      insuranceId: '', // Filled in by 8.1.5 once payer/insurance lookup wires up.
      encounterId: billingClaim.encounterCoreId,
      status:      'SUBMITTED',
      response:    {
        gatewayResponse: response.bundle as unknown as Record<string, unknown>,
        gatewayHttpStatus: response.httpStatus,
        gatewayCorrelationId: response.correlationId,
        gatewayElapsedMs: response.elapsedMs,
        gatewaySentAt: new Date().toISOString(),
        // Phase 8.1.5 — validation summary persisted alongside the response.
        validationIssueCount: response.validationIssueCount,
        validationFailed:     response.validationFailed,
      } as never,
    },
  });

  logger.info('NPHIES claim sent + persisted', {
    category: 'integration' as const,
    subsystem: 'nphies.http',
    tenantId,
    claimId,
    correlationId: response.correlationId,
    httpStatus: response.httpStatus,
  });

  return response;
}
