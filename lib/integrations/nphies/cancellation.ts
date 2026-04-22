// =============================================================================
// NPHIES Cancellation — Cancel Claims & Prior Authorizations
// =============================================================================

import { getNphiesClient } from './client';
import { withRetry } from './retry';
import { nphiesConfig } from './config';
import { logger } from '@/lib/monitoring/logger';
import { v4 as uuidv4 } from 'uuid';
import {
  type NphiesSendBundleResult,
  NphiesError,
  NPHIES_PROFILES,
  NPHIES_SYSTEMS,
} from './types';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface CancellationRequest {
  tenantId: string;
  /** Original claim or prior-auth reference issued by NPHIES */
  originalReference: string;
  /** Reason for cancellation */
  cancellationReason: string;
  /** User ID of the person requesting cancellation */
  requestedBy: string;
  /** Whether this cancels a claim or a prior-auth */
  type: 'claim' | 'prior-auth';
  /** Insurer ID (payer license) for the request */
  insurerId?: string;
}

export interface CancellationResponse {
  success: boolean;
  cancellationId: string;
  status: 'cancelled' | 'pending-review' | 'rejected';
  message?: string;
  messageAr?: string;
  responseDate: string;
  rawResponse?: unknown;
}

// ---------------------------------------------------------------------------
// Cancel Request
// ---------------------------------------------------------------------------

export async function cancelRequest(
  req: CancellationRequest,
): Promise<CancellationResponse> {
  nphiesConfig.validate();
  const client = getNphiesClient();

  const taskId = uuidv4();
  const cancellationId = uuidv4();

  // Build a FHIR Task resource for cancellation
  const cancelTask = {
    resourceType: 'Task',
    id: taskId,
    status: 'requested',
    intent: 'order',
    code: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/financialtaskcode',
          code: 'cancel',
        },
      ],
    },
    focus: {
      identifier: {
        system: NPHIES_SYSTEMS.PROVIDER_LICENSE,
        value: req.originalReference,
      },
    },
    reasonCode: {
      text: req.cancellationReason,
    },
    requester: {
      type: 'Organization',
      identifier: {
        system: NPHIES_SYSTEMS.PROVIDER_LICENSE,
        value: client.licenseId,
      },
    },
    owner: req.insurerId
      ? {
          type: 'Organization',
          identifier: {
            system: NPHIES_SYSTEMS.PAYER_LICENSE,
            value: req.insurerId,
          },
        }
      : undefined,
    authoredOn: new Date().toISOString(),
    input: [
      {
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/financialtaskinputtype',
              code: 'origresponse',
            },
          ],
        },
        valueReference: {
          identifier: {
            system: NPHIES_SYSTEMS.PROVIDER_LICENSE,
            value: req.originalReference,
          },
        },
      },
    ],
  };

  // Use 'cancel-request' message event
  const messageHeader = client.generateMessageHeader(
    'cancel-request',
    `Task/${taskId}`,
  );

  const bundle = client.createBundle('message', [messageHeader, cancelTask]);

  logger.info('NPHIES cancellation request started', {
    category: 'billing',
    type: req.type,
    originalReference: req.originalReference,
    cancellationReason: req.cancellationReason,
    requestedBy: req.requestedBy,
    tenantId: req.tenantId,
  });

  const response = await withRetry(
    () => client.sendBundle(bundle),
    `cancel-${req.type}`,
  );

  const result = parseCancellationResponse(response, cancellationId);

  logger.info('NPHIES cancellation request completed', {
    category: 'billing',
    type: req.type,
    originalReference: req.originalReference,
    cancellationId: result.cancellationId,
    status: result.status,
    success: result.success,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Response Parsing
// ---------------------------------------------------------------------------

function parseCancellationResponse(
  response: NphiesSendBundleResult,
  cancellationId: string,
): CancellationResponse {
  const now = new Date().toISOString();

  if (!response.success) {
    const errorMsg = extractErrorMessage(response.error);
    return {
      success: false,
      cancellationId,
      status: 'rejected',
      message: errorMsg,
      messageAr: 'فشل طلب الإلغاء',
      responseDate: now,
      rawResponse: response,
    };
  }

  try {
    const bundle = response.data as any;

    // Look for a Task resource in the response that indicates the cancellation outcome
    const taskResponse = bundle?.entry?.find(
      (e: any) => e.resource?.resourceType === 'Task',
    )?.resource;

    // Also check for an OperationOutcome (used for errors / rejections)
    const operationOutcome = bundle?.entry?.find(
      (e: any) => e.resource?.resourceType === 'OperationOutcome',
    )?.resource;

    if (operationOutcome) {
      const issues = operationOutcome.issue || [];
      const hasError = issues.some(
        (i: any) => i.severity === 'error' || i.severity === 'fatal',
      );
      if (hasError) {
        const errorText =
          issues[0]?.diagnostics ||
          issues[0]?.details?.text ||
          'Cancellation rejected';
        return {
          success: false,
          cancellationId,
          status: 'rejected',
          message: errorText,
          messageAr: 'تم رفض طلب الإلغاء',
          responseDate: now,
          rawResponse: response,
        };
      }
    }

    if (taskResponse) {
      const taskStatus = taskResponse.status;
      const mappedStatus = mapTaskStatusToCancellationStatus(taskStatus);

      return {
        success: mappedStatus === 'cancelled',
        cancellationId,
        status: mappedStatus,
        message: taskResponse.statusReason?.text || taskResponse.note?.[0]?.text,
        messageAr: mappedStatus === 'cancelled'
          ? 'تم الإلغاء بنجاح'
          : mappedStatus === 'pending-review'
          ? 'طلب الإلغاء قيد المراجعة'
          : 'تم رفض طلب الإلغاء',
        responseDate: taskResponse.lastModified || now,
        rawResponse: response,
      };
    }

    // If we have a successful response but no Task, check the MessageHeader response code
    const messageHeader = bundle?.entry?.find(
      (e: any) => e.resource?.resourceType === 'MessageHeader',
    )?.resource;

    const responseCode = messageHeader?.response?.code;
    if (responseCode === 'ok') {
      return {
        success: true,
        cancellationId,
        status: 'cancelled',
        message: 'Cancellation accepted',
        messageAr: 'تم قبول الإلغاء',
        responseDate: now,
        rawResponse: response,
      };
    }

    // Fallback — got a response but cannot determine status
    return {
      success: false,
      cancellationId,
      status: 'pending-review',
      message: 'Cancellation submitted, awaiting review',
      messageAr: 'تم تقديم طلب الإلغاء وهو قيد المراجعة',
      responseDate: now,
      rawResponse: response,
    };
  } catch (err) {
    logger.error('NPHIES cancellation response parse error', {
      category: 'billing',
      error: err,
    });
    return {
      success: false,
      cancellationId,
      status: 'rejected',
      message: 'Failed to parse cancellation response',
      messageAr: 'فشل في تحليل رد الإلغاء',
      responseDate: now,
      rawResponse: response,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapTaskStatusToCancellationStatus(
  taskStatus?: string,
): 'cancelled' | 'pending-review' | 'rejected' {
  switch (taskStatus) {
    case 'completed':
    case 'cancelled':
      return 'cancelled';
    case 'in-progress':
    case 'requested':
    case 'received':
    case 'accepted':
    case 'on-hold':
      return 'pending-review';
    case 'rejected':
    case 'failed':
      return 'rejected';
    default:
      return 'pending-review';
  }
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as Error).message);
  }
  return 'Cancellation request failed';
}
