import { logger } from '@/lib/monitoring/logger';
import { getCVisionDb } from '@/lib/cvision/db';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';

const RETRY_DELAYS = [1000, 10000, 60000];

function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export async function dispatchWebhook(tenantId: string, event: string, payload: any) {
  try {
    const db = await getCVisionDb(tenantId);
    const subs = await db.collection('cvision_webhook_subscriptions')
      .find({ tenantId, isActive: true, events: event })
      .toArray();

    for (const sub of subs) {
      const s = sub as any;
      const deliveryId = uuid();
      const body = JSON.stringify({ event, payload, deliveredAt: new Date().toISOString(), deliveryId });
      const signature = s.secret ? sign(body, s.secret) : '';

      let status = 'PENDING';
      let responseStatus = 0;
      let responseBody = '';
      let duration = 0;
      let lastAttempt = 0;

      for (let attempt = 0; attempt <= (s.retryCount || 3); attempt++) {
        if (attempt > 0) {
          const delay = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
          await new Promise(r => setTimeout(r, delay));
        }

        const start = Date.now();
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-CVision-Signature': signature,
            'X-CVision-Event': event,
            'X-CVision-Delivery': deliveryId,
            ...(s.headers || {}),
          };
          const res = await fetch(s.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) });
          duration = Date.now() - start;
          responseStatus = res.status;
          responseBody = (await res.text()).slice(0, 2000);
          lastAttempt = attempt + 1;

          if (res.ok) { status = 'SUCCESS'; break; }
          status = 'FAILED';
        } catch (e: any) {
          duration = Date.now() - start;
          responseBody = e.message || 'Unknown error';
          status = 'FAILED';
          lastAttempt = attempt + 1;
        }
      }

      await db.collection('cvision_webhook_deliveries').insertOne({
        tenantId, webhookId: s.webhookId, deliveryId, event,
        payload, responseStatus, responseBody, duration,
        attempt: lastAttempt, status, createdAt: new Date(),
      });
    }
  } catch (err) {
    logger.error('[Webhook] dispatch error:', err);
  }
}
