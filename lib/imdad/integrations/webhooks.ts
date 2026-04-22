/**
 * Imdad Webhook Dispatcher
 *
 * Dispatches webhook events to registered webhook endpoints.
 * Handles HMAC signing, timeouts, and delivery logging.
 */

import { prisma } from '@/lib/db/prisma';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DispatchOptions {
  eventType: string;
  tenantId: string;
  data: Record<string, unknown>;
  organizationId?: string;
}

interface DispatchResult {
  dispatched: number;
  results: Array<{
    webhookId: string;
    success: boolean;
    httpStatusCode?: number;
    responseTimeMs: number;
    error?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Dispatch a webhook event to all active webhooks that subscribe to the given eventType.
 */
export async function dispatchWebhook(options: DispatchOptions): Promise<DispatchResult> {
  const { eventType, tenantId, data, organizationId } = options;

  // Find all active webhooks that subscribe to this event type
  const where: any = {
    tenantId,
    isActive: true,
    isDeleted: false,
    eventTypes: { has: eventType },
  };
  if (organizationId) where.organizationId = organizationId;

  const webhooks = await prisma.imdadWebhook.findMany({ where, take: 100 });

  const results: DispatchResult['results'] = [];

  for (const webhook of webhooks) {
    const payloadObj = {
      eventType,
      timestamp: new Date().toISOString(),
      tenantId,
      data,
    };
    const payloadStr = JSON.stringify(payloadObj);

    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(payloadStr, 'utf8')
      .digest('hex');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    let httpStatusCode: number | undefined;
    let responseBody = '';
    let responseTimeMs = 0;
    let isSuccess = false;
    let errorMessage: string | undefined;

    const start = Date.now();
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SCM-Signature': signature,
          'X-SCM-Timestamp': payloadObj.timestamp,
          ...((webhook.headers as Record<string, string>) ?? {}),
        },
        body: payloadStr,
        signal: controller.signal,
      });

      responseTimeMs = Date.now() - start;
      httpStatusCode = response.status;
      responseBody = await response.text().catch(() => '');
      responseBody = responseBody.slice(0, 4000);
      isSuccess = httpStatusCode >= 200 && httpStatusCode < 300;
    } catch (err: unknown) {
      responseTimeMs = Date.now() - start;
      errorMessage = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      clearTimeout(timeout);
    }

    // Log delivery
    try {
      await prisma.imdadWebhookDelivery.create({
        data: {
          tenantId,
          webhookId: webhook.id,
          eventType,
          payload: payloadObj as any,
          httpStatusCode,
          responseBody: responseBody || null,
          responseTimeMs,
          attempt: 1,
          isSuccess,
          errorMessage: errorMessage ?? (isSuccess ? null : `HTTP ${httpStatusCode}`),
        } as any,
      });
    } catch (logErr) {
      console.error('[IMDAD_WEBHOOK] Failed to log delivery:', logErr);
    }

    results.push({
      webhookId: webhook.id,
      success: isSuccess,
      httpStatusCode,
      responseTimeMs,
      error: errorMessage ?? (isSuccess ? undefined : `HTTP ${httpStatusCode}`),
    });
  }

  return { dispatched: results.length, results };
}
