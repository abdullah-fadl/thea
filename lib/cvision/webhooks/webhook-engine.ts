import type { Db } from '@/lib/cvision/infra/mongo-compat';
import { checkRateLimit } from '@/lib/cvision/middleware/rate-limiter';

const WEBHOOK_RATE_LIMIT = { windowMs: 60_000, maxRequests: 100 };

const SUBSCRIPTIONS = 'cvision_webhook_subscriptions';
const DELIVERIES = 'cvision_webhook_deliveries';

/* ── Event Catalog ─────────────────────────────────────────────────── */

export const WEBHOOK_EVENTS = [
  'employee.created', 'employee.updated', 'employee.terminated', 'employee.transferred',
  'attendance.clockIn', 'attendance.clockOut', 'attendance.absent',
  'leave.requested', 'leave.approved', 'leave.rejected', 'leave.cancelled',
  'payroll.calculated', 'payroll.approved', 'payroll.disbursed',
  'job.created', 'candidate.applied', 'candidate.statusChanged', 'candidate.hired',
  'insurance.enrolled', 'insurance.upgraded', 'claim.submitted', 'claim.approved',
  'training.enrolled', 'training.completed', 'certificate.expiring',
  'loan.requested', 'loan.approved', 'loan.disbursed', 'installment.paid',
  'contract.created', 'contract.expiring', 'contract.renewed',
  'approval.pending', 'approval.completed',
  'document.expiring', 'notification.sent',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/* ── Types ─────────────────────────────────────────────────────────── */

export interface WebhookSubscription {
  _id?: any;
  tenantId: string;
  subscriptionId: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  headers?: Record<string, string>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDelivery {
  _id?: any;
  tenantId: string;
  subscriptionId: string;
  event: string;
  payload: any;
  status: 'QUEUED' | 'DELIVERING' | 'DELIVERED' | 'FAILED';
  httpStatus?: number;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  lastError?: string;
  createdAt: Date;
}

/* ── Subscription CRUD ─────────────────────────────────────────────── */

export async function listSubscriptions(db: Db, tenantId: string) {
  return db.collection(SUBSCRIPTIONS).find({ tenantId }).sort({ createdAt: -1 }).toArray();
}

export async function createSubscription(db: Db, tenantId: string, data: Partial<WebhookSubscription>) {
  const now = new Date();
  const subscriptionId = `WH-${Date.now().toString(36).toUpperCase()}`;
  const doc: WebhookSubscription = {
    tenantId,
    subscriptionId,
    name: data.name || 'Untitled',
    url: data.url || '',
    secret: data.secret || generateSecret(),
    events: data.events || [],
    headers: data.headers || {},
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(SUBSCRIPTIONS).insertOne(doc);
  return doc;
}

export async function updateSubscription(db: Db, tenantId: string, subscriptionId: string, data: Partial<WebhookSubscription>) {
  await db.collection(SUBSCRIPTIONS).updateOne(
    { tenantId, subscriptionId },
    { $set: { ...data, updatedAt: new Date() } },
  );
  return db.collection(SUBSCRIPTIONS).findOne({ tenantId, subscriptionId });
}

export async function deleteSubscription(db: Db, tenantId: string, subscriptionId: string) {
  return db.collection(SUBSCRIPTIONS).deleteOne({ tenantId, subscriptionId });
}

/* ── Dispatch ──────────────────────────────────────────────────────── */

export async function dispatch(db: Db, tenantId: string, event: string, payload: any) {
  const rl = checkRateLimit(`webhook:${tenantId}`, WEBHOOK_RATE_LIMIT);
  if (!rl.allowed) {
    const { logger } = await import('@/lib/monitoring/logger');
    logger.warn(`[WEBHOOK] Rate limit exceeded for tenant ${tenantId}. Retry after ${rl.retryAfter}s.`);
    return { queued: 0, rateLimited: true };
  }

  const subs = await db.collection(SUBSCRIPTIONS).find({
    tenantId, active: true, events: event,
  }).toArray();

  const deliveries: WebhookDelivery[] = [];
  const now = new Date();

  for (const sub of subs) {
    const delivery: WebhookDelivery = {
      tenantId,
      subscriptionId: sub.subscriptionId,
      event,
      payload: { event, timestamp: now.toISOString(), data: payload },
      status: 'QUEUED',
      attempts: 0,
      maxAttempts: 5,
      createdAt: now,
    };
    await db.collection(DELIVERIES).insertOne(delivery);
    deliveries.push(delivery);
  }

  return { queued: deliveries.length };
}

/**
 * Process queued deliveries (called by cron every 15 min or immediately)
 * In production, this would use fetch with timeout and retry.
 */
export async function processDeliveries(db: Db, tenantId: string) {
  const queued = await db.collection(DELIVERIES).find({
    tenantId, status: { $in: ['QUEUED', 'FAILED'] },
    attempts: { $lt: 5 },
  }).limit(50).toArray();

  let delivered = 0;
  let failed = 0;

  for (const delivery of queued) {
    const sub = await db.collection(SUBSCRIPTIONS).findOne({
      tenantId, subscriptionId: delivery.subscriptionId, active: true,
    });
    if (!sub) {
      await db.collection(DELIVERIES).updateOne({ _id: delivery._id, tenantId }, { $set: { status: 'FAILED', lastError: 'Subscription inactive or deleted' } });
      failed++;
      continue;
    }

    try {
      const res = await fetch(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': sub.secret,
          'X-Webhook-Event': delivery.event,
          ...sanitizeHeaders(sub.headers || {}),
        },
        body: JSON.stringify(delivery.payload),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        await db.collection(DELIVERIES).updateOne({ _id: delivery._id, tenantId }, {
          $set: { status: 'DELIVERED', httpStatus: res.status, lastAttemptAt: new Date() },
          $inc: { attempts: 1 },
        });
        delivered++;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err: any) {
      const newAttempts = (delivery.attempts || 0) + 1;
      await db.collection(DELIVERIES).updateOne({ _id: delivery._id, tenantId }, {
        $set: {
          status: newAttempts >= delivery.maxAttempts ? 'FAILED' : 'QUEUED',
          lastError: err.message,
          lastAttemptAt: new Date(),
        },
        $inc: { attempts: 1 },
      });
      failed++;
    }
  }

  return { processed: queued.length, delivered, failed };
}

/* ── Delivery History ──────────────────────────────────────────────── */

export async function getDeliveries(db: Db, tenantId: string, subscriptionId?: string, limit = 50) {
  const query: any = { tenantId };
  if (subscriptionId) query.subscriptionId = subscriptionId;
  return db.collection(DELIVERIES).find(query).sort({ createdAt: -1 }).limit(limit).toArray();
}

/* ── Helpers ───────────────────────────────────────────────────────── */

const BLOCKED_HEADERS = new Set([
  'host', 'authorization', 'cookie', 'x-forwarded-for', 'x-forwarded-host',
  'x-forwarded-proto', 'x-real-ip', 'content-type', 'content-length',
  'x-webhook-secret', 'x-webhook-event',
]);

function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!BLOCKED_HEADERS.has(key.toLowerCase())) safe[key] = value;
  }
  return safe;
}

function generateSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `whsec_${hex}`;
}
