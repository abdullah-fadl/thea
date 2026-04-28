/**
 * SCM Integrations — Test Webhook
 *
 * POST /api/imdad/integrations/webhooks/test — Send a test event to a webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { dispatchWebhook } from '@/lib/imdad/integrations/webhooks';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST — Send test webhook
// ---------------------------------------------------------------------------

const testWebhookSchema = z.object({
  webhookId: z.string().uuid(),
  eventType: z.string().min(1).max(100).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const parsed = testWebhookSchema.parse(body);

      // Verify webhook exists and belongs to tenant
      const webhook = await prisma.imdadWebhook.findFirst({
        where: {
          id: parsed.webhookId,
          tenantId,
          isDeleted: false,
        },
      });

      if (!webhook) {
        return NextResponse.json(
          { error: 'Webhook not found' },
          { status: 404 },
        );
      }

      const testEventType = parsed.eventType || 'test.ping';

      const testPayload = {
        message: 'This is a test webhook delivery from Thea SCM',
        webhookId: webhook.id,
        webhookName: webhook.name,
        triggeredBy: userId,
        timestamp: new Date().toISOString(),
      };

      // Temporarily ensure the webhook accepts this event type for the test
      // We dispatch directly to the single webhook rather than going through
      // the normal dispatch which filters by eventType subscription
      const crypto = await import('crypto');
      const payloadStr = JSON.stringify({
        eventType: testEventType,
        timestamp: new Date().toISOString(),
        tenantId,
        data: testPayload,
      });
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
            'X-SCM-Timestamp': new Date().toISOString(),
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

      // Log the test delivery
      await prisma.imdadWebhookDelivery.create({
        data: {
          tenantId,
          webhookId: webhook.id,
          eventType: testEventType,
          payload: testPayload as any,
          httpStatusCode,
          responseBody: responseBody || null,
          responseTimeMs,
          attempt: 1,
          isSuccess,
          errorMessage: errorMessage ?? (isSuccess ? null : `HTTP ${httpStatusCode}`),
        } as any,
      });

      return NextResponse.json({
        data: {
          success: isSuccess,
          httpStatusCode,
          responseTimeMs,
          errorMessage: errorMessage ?? (isSuccess ? undefined : `HTTP ${httpStatusCode}`),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 },
      );
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.integrations.webhook.manage' },
);
