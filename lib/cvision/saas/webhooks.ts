import { logger } from '@/lib/monitoring/logger';
/**
 * CVision SaaS — Webhook System
 *
 * Subscribe to events, deliver payloads with HMAC-SHA256 signatures,
 * automatic retries, and failure circuit-breaker.
 */

import { Collection, Db, ObjectId } from '@/lib/cvision/infra/mongo-compat';
import { createHmac, randomBytes } from 'crypto';
import { getPlatformClient } from '@/lib/db/mongo';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface WebhookSubscription {
  _id?: ObjectId;
  tenantId: string;
  subscriptionId: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  failureCount: number;
  maxRetries: number;
  lastDelivery?: Date;
  lastStatus?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEvent {
  _id?: ObjectId;
  tenantId: string;
  subscriptionId: string;
  eventType: string;
  payload: any;
  deliveryStatus: 'PENDING' | 'DELIVERED' | 'FAILED' | 'RETRYING';
  attempts: number;
  lastAttempt?: Date;
  nextRetry?: Date;
  responseStatus?: number;
  responseBody?: string;
  deliveryId: string;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════
// Event catalog
// ═══════════════════════════════════════════════════════════════════════════

export const WEBHOOK_EVENTS: Record<string, string> = {
  'employee.created': 'New employee added',
  'employee.updated': 'Employee data updated',
  'employee.terminated': 'Employee terminated',
  'employee.status_changed': 'Employee status changed',

  'attendance.checked_in': 'Employee checked in',
  'attendance.checked_out': 'Employee checked out',
  'attendance.absent': 'Employee marked absent',

  'leave.requested': 'Leave request submitted',
  'leave.approved': 'Leave request approved',
  'leave.rejected': 'Leave request rejected',

  'payroll.processed': 'Payroll run completed',
  'payroll.paid': 'Salaries transferred',

  'performance.review_completed': 'Performance review completed',
  'performance.cycle_started': 'New review cycle started',

  'promotion.approved': 'Promotion approved',
  'promotion.applied': 'Promotion applied',

  'disciplinary.warning_issued': 'Warning issued to employee',

  'retention.high_risk_detected': 'Employee flagged as high flight risk',
  'retention.critical_alert': 'Critical retention alert',

  'muqeem.iqama_expiring': 'Iqama expiring soon',
  'muqeem.iqama_expired': 'Iqama expired',

  'subscription.expiring': 'Subscription expiring soon',
  'subscription.expired': 'Subscription expired',
};

// ═══════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════

const SUBS_COLLECTION = 'cvision_webhooks';
const EVENTS_COLLECTION = 'cvision_webhook_events';
const MAX_CONSECUTIVE_FAILURES = 10;
const RETRY_DELAYS_MS = [5_000, 30_000, 120_000]; // 5s, 30s, 2min

function generateSubscriptionId(): string {
  return `whk_${randomBytes(12).toString('hex')}`;
}

function generateDeliveryId(): string {
  return `evt_${randomBytes(16).toString('hex')}`;
}

function generateSecret(): string {
  return `whsec_${randomBytes(32).toString('base64url')}`;
}

async function getPlatformDb(): Promise<Db> {
  const { db } = await getPlatformClient();
  return db;
}

async function getSubsCollection(): Promise<Collection<WebhookSubscription>> {
  const db = await getPlatformDb();
  return db.collection<WebhookSubscription>(SUBS_COLLECTION);
}

async function getEventsCollection(): Promise<Collection<WebhookEvent>> {
  const db = await getPlatformDb();
  return db.collection<WebhookEvent>(EVENTS_COLLECTION);
}

// ═══════════════════════════════════════════════════════════════════════════
// HMAC signature
// ═══════════════════════════════════════════════════════════════════════════

export function signWebhookPayload(payload: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = signWebhookPayload(payload, secret);
  if (signature.length !== expected.length) return false;

  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// Create / List / Delete subscriptions
// ═══════════════════════════════════════════════════════════════════════════

export async function createWebhook(
  tenantId: string,
  data: { url: string; events: string[]; maxRetries?: number; metadata?: Record<string, any> },
): Promise<{ subscription: WebhookSubscription; secret: string }> {
  const col = await getSubsCollection();

  const secret = generateSecret();
  const sub: WebhookSubscription = {
    tenantId,
    subscriptionId: generateSubscriptionId(),
    url: data.url,
    secret,
    events: data.events,
    isActive: true,
    failureCount: 0,
    maxRetries: data.maxRetries ?? 3,
    metadata: data.metadata,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await col.insertOne(sub as any);
  return { subscription: sub, secret };
}

export async function listWebhooks(tenantId: string): Promise<WebhookSubscription[]> {
  const col = await getSubsCollection();
  return col.find(
    { tenantId },
    { projection: { secret: 0 } },
  ).sort({ createdAt: -1 }).toArray();
}

export async function getWebhook(
  tenantId: string,
  subscriptionId: string,
): Promise<WebhookSubscription | null> {
  const col = await getSubsCollection();
  return col.findOne({ tenantId, subscriptionId }, { projection: { secret: 0 } });
}

export async function deleteWebhook(
  tenantId: string,
  subscriptionId: string,
): Promise<void> {
  const col = await getSubsCollection();
  await col.deleteOne({ tenantId, subscriptionId });
}

export async function updateWebhook(
  tenantId: string,
  subscriptionId: string,
  updates: Partial<Pick<WebhookSubscription, 'url' | 'events' | 'isActive' | 'maxRetries'>>,
): Promise<WebhookSubscription | null> {
  const col = await getSubsCollection();
  const result = await col.findOneAndUpdate(
    { tenantId, subscriptionId },
    { $set: { ...updates, updatedAt: new Date() } },
    { returnDocument: 'after', projection: { secret: 0 } },
  );
  return result ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Fire + Deliver
// ═══════════════════════════════════════════════════════════════════════════

export async function fireWebhookEvent(
  tenantId: string,
  eventType: string,
  data: any,
): Promise<void> {
  const col = await getSubsCollection();

  const subscriptions = await col.find({
    tenantId,
    isActive: true,
    events: { $in: [eventType, '*'] },
  }).toArray();

  if (subscriptions.length === 0) return;

  const eventsCol = await getEventsCollection();

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const deliveryId = generateDeliveryId();
      const event: WebhookEvent = {
        tenantId,
        subscriptionId: sub.subscriptionId,
        eventType,
        payload: data,
        deliveryStatus: 'PENDING',
        attempts: 0,
        deliveryId,
        createdAt: new Date(),
      };
      await eventsCol.insertOne(event as any);

      // Attempt delivery with retries
      await deliverWithRetries(sub, event);
    }),
  );
}

async function deliverWithRetries(
  subscription: WebhookSubscription,
  event: WebhookEvent,
): Promise<void> {
  const eventsCol = await getEventsCollection();
  const subsCol = await getSubsCollection();

  const maxRetries = subscription.maxRetries;
  let delivered = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
      await new Promise(r => setTimeout(r, delay));
      await eventsCol.updateOne(
        { deliveryId: event.deliveryId },
        { $set: { deliveryStatus: 'RETRYING' } },
      );
    }

    const success = await deliverWebhook(subscription, event);
    if (success) {
      delivered = true;
      break;
    }
  }

  if (delivered) {
    await subsCol.updateOne(
      { subscriptionId: subscription.subscriptionId },
      {
        $set: { failureCount: 0, lastDelivery: new Date(), updatedAt: new Date() },
      },
    );
  } else {
    const result = await subsCol.findOneAndUpdate(
      { subscriptionId: subscription.subscriptionId },
      {
        $inc: { failureCount: 1 },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' },
    );

    // Circuit breaker: disable after too many consecutive failures
    if (result && result.failureCount >= MAX_CONSECUTIVE_FAILURES) {
      await subsCol.updateOne(
        { subscriptionId: subscription.subscriptionId },
        { $set: { isActive: false, updatedAt: new Date() } },
      );
    }
  }
}

export async function deliverWebhook(
  subscription: WebhookSubscription,
  event: WebhookEvent,
): Promise<boolean> {
  const eventsCol = await getEventsCollection();
  const now = new Date();

  const body = JSON.stringify({
    event: event.eventType,
    timestamp: now.toISOString(),
    tenantId: event.tenantId,
    data: event.payload,
  });

  const signature = signWebhookPayload(body, subscription.secret);
  const timestamp = Math.floor(now.getTime() / 1000).toString();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(subscription.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CVision-Event': event.eventType,
        'X-CVision-Delivery': event.deliveryId,
        'X-CVision-Signature': signature,
        'X-CVision-Timestamp': timestamp,
        'User-Agent': 'CVision-Webhooks/1.0',
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    let responseBody = '';
    try {
      responseBody = await response.text();
    } catch {
      responseBody = '<unreadable>';
    }

    const success = response.status >= 200 && response.status < 300;

    await eventsCol.updateOne(
      { deliveryId: event.deliveryId },
      {
        $set: {
          deliveryStatus: success ? 'DELIVERED' : 'FAILED',
          responseStatus: response.status,
          responseBody: responseBody.slice(0, 1000),
          lastAttempt: now,
        },
        $inc: { attempts: 1 },
      },
    );

    return success;
  } catch (err: any) {
    await eventsCol.updateOne(
      { deliveryId: event.deliveryId },
      {
        $set: {
          deliveryStatus: 'FAILED',
          responseBody: err.message?.slice(0, 500) || 'Unknown error',
          lastAttempt: now,
        },
        $inc: { attempts: 1 },
      },
    );
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Background retry for failed / pending webhooks (called by cron)
// ═══════════════════════════════════════════════════════════════════════════

export interface RetryResult {
  processed: number;
  delivered: number;
  failed: number;
  disabled: number;
  errors: string[];
}

/**
 * Finds webhook events that are due for retry and attempts redelivery.
 * Intended to be called by a cron job on a regular schedule (e.g. every minute).
 *
 * - Picks up events with deliveryStatus in ['RETRYING','PENDING'] and nextRetry <= now
 * - Limits to `batchSize` (default 50) per invocation
 * - On success: marks DELIVERED, resets subscription failureCount
 * - On failure after maxRetries: marks FAILED, increments subscription failureCount
 * - Circuit-breaker: disables subscriptions with failureCount >= 10
 */
export async function retryFailedWebhooks(batchSize = 50): Promise<RetryResult> {
  const eventsCol = await getEventsCollection();
  const subsCol = await getSubsCollection();
  const now = new Date();

  const result: RetryResult = {
    processed: 0,
    delivered: 0,
    failed: 0,
    disabled: 0,
    errors: [],
  };

  // 1. Find events that are due for retry
  const pendingEvents = await eventsCol
    .find({
      deliveryStatus: { $in: ['RETRYING', 'PENDING'] as const },
      nextRetry: { $lte: now },
    })
    .sort({ nextRetry: 1 })
    .limit(batchSize)
    .toArray();

  if (pendingEvents.length === 0) return result;

  // 2. Process each event
  for (const event of pendingEvents) {
    result.processed++;

    try {
      // Look up the subscription (with secret for signing)
      const subscription = await subsCol.findOne({
        subscriptionId: event.subscriptionId,
      });

      if (!subscription) {
        // Subscription deleted — mark event as FAILED
        await eventsCol.updateOne(
          { deliveryId: event.deliveryId },
          {
            $set: {
              deliveryStatus: 'FAILED' as const,
              responseBody: 'Subscription not found',
              lastAttempt: now,
            },
          },
        );
        result.failed++;
        continue;
      }

      // Skip if subscription has been deactivated
      if (!subscription.isActive) {
        await eventsCol.updateOne(
          { deliveryId: event.deliveryId },
          {
            $set: {
              deliveryStatus: 'FAILED' as const,
              responseBody: 'Subscription disabled',
              lastAttempt: now,
            },
          },
        );
        result.failed++;
        continue;
      }

      // Attempt delivery
      const success = await deliverWebhook(subscription, event);

      if (success) {
        // deliverWebhook already set status to DELIVERED and incremented attempts
        result.delivered++;

        // Reset subscription failure count on success
        await subsCol.updateOne(
          { subscriptionId: subscription.subscriptionId },
          {
            $set: {
              failureCount: 0,
              lastDelivery: now,
              updatedAt: now,
            },
          },
        );
      } else {
        // deliverWebhook already set status to FAILED and incremented attempts
        const newAttempts = (event.attempts || 0) + 1;
        const maxRetries = subscription.maxRetries || 3;

        if (newAttempts < maxRetries) {
          // Schedule next retry with exponential backoff
          const delayMs =
            RETRY_DELAYS_MS[Math.min(newAttempts - 1, RETRY_DELAYS_MS.length - 1)];
          const nextRetry = new Date(now.getTime() + delayMs);

          await eventsCol.updateOne(
            { deliveryId: event.deliveryId },
            {
              $set: {
                deliveryStatus: 'RETRYING' as const,
                nextRetry,
              },
            },
          );
        } else {
          // Max retries exceeded — mark as permanently FAILED
          await eventsCol.updateOne(
            { deliveryId: event.deliveryId },
            { $set: { deliveryStatus: 'FAILED' as const } },
          );
          result.failed++;
        }

        // Increment subscription failure count
        const updatedSub = await subsCol.findOneAndUpdate(
          { subscriptionId: subscription.subscriptionId },
          {
            $inc: { failureCount: 1 },
            $set: { updatedAt: now },
          },
          { returnDocument: 'after' },
        );

        // Circuit breaker: disable after MAX_CONSECUTIVE_FAILURES
        if (updatedSub && updatedSub.failureCount >= MAX_CONSECUTIVE_FAILURES) {
          await subsCol.updateOne(
            { subscriptionId: subscription.subscriptionId },
            { $set: { isActive: false, updatedAt: now } },
          );
          result.disabled++;
          logger.warn(
            `[Webhook Retry] Circuit breaker tripped — disabled subscription ${subscription.subscriptionId} after ${updatedSub.failureCount} consecutive failures`,
          );
        }
      }
    } catch (err: any) {
      const msg = `Event ${event.deliveryId}: ${err.message || 'Unknown error'}`;
      result.errors.push(msg);
      logger.error(`[Webhook Retry] ${msg}`);
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// Test webhook
// ═══════════════════════════════════════════════════════════════════════════

export async function testWebhook(
  tenantId: string,
  subscriptionId: string,
): Promise<{ success: boolean; status?: number; body?: string }> {
  const col = await getSubsCollection();
  const sub = await col.findOne({ tenantId, subscriptionId });
  if (!sub) return { success: false, body: 'Subscription not found' };

  const testPayload = {
    event: 'test.ping',
    timestamp: new Date().toISOString(),
    tenantId,
    data: {
      message: 'This is a test webhook delivery from CVision.',
      subscriptionId,
    },
  };

  const body = JSON.stringify(testPayload);
  const signature = signWebhookPayload(body, sub.secret);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(sub.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CVision-Event': 'test.ping',
        'X-CVision-Delivery': generateDeliveryId(),
        'X-CVision-Signature': signature,
        'X-CVision-Timestamp': timestamp,
        'User-Agent': 'CVision-Webhooks/1.0',
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseBody = await response.text().catch(() => '');

    return {
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      body: responseBody.slice(0, 500),
    };
  } catch (err: any) {
    return { success: false, body: err.message || 'Request failed' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Delivery history
// ═══════════════════════════════════════════════════════════════════════════

export async function getWebhookHistory(
  tenantId: string,
  subscriptionId?: string,
  limit = 50,
): Promise<WebhookEvent[]> {
  const col = await getEventsCollection();
  const filter: Record<string, any> = { tenantId };
  if (subscriptionId) filter.subscriptionId = subscriptionId;

  return col.find(filter).sort({ createdAt: -1 }).limit(limit).toArray();
}

// ═══════════════════════════════════════════════════════════════════════════
// Indexes
// ═══════════════════════════════════════════════════════════════════════════

export async function ensureWebhookIndexes(): Promise<void> {
  const subsCol = await getSubsCollection();
  await subsCol.createIndex({ tenantId: 1, subscriptionId: 1 }, { unique: true });
  await subsCol.createIndex({ tenantId: 1, isActive: 1, events: 1 });

  const eventsCol = await getEventsCollection();
  await eventsCol.createIndex({ deliveryId: 1 }, { unique: true });
  await eventsCol.createIndex({ tenantId: 1, createdAt: -1 });
  await eventsCol.createIndex({ subscriptionId: 1, createdAt: -1 });
  await eventsCol.createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 30 * 86400 },
  );
  // Index for the retry cron query
  await eventsCol.createIndex({ deliveryStatus: 1, nextRetry: 1 });
}
