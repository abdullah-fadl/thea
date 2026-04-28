/**
 * FHIR Subscription Manager
 *
 * Manages FHIR R4 Subscriptions — channels for real-time notifications
 * when resources change. Supports rest-hook (webhook) channel type.
 *
 * Subscriptions are stored in the `fhir_subscriptions` table (Prisma model:
 * FhirSubscription). When a resource is created/updated that matches a
 * subscription's criteria, we POST a notification to the subscriber's endpoint.
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/db/prisma';
import type { FhirSubscription as FhirSubscriptionResource } from '../resources/types';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubscriptionRecord {
  id: string;
  tenantId: string;
  status: 'requested' | 'active' | 'error' | 'off';
  reason: string;
  criteria: string; // e.g. "Observation?category=laboratory"
  channelType: string; // 'rest-hook' | 'websocket' | 'email'
  channelEndpoint: string;
  channelPayload: string; // 'application/fhir+json'
  channelHeaders: string[];
  end?: string; // Expiration date ISO string
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionNotification {
  subscriptionId: string;
  resourceType: string;
  resourceId: string;
  action: 'create' | 'update' | 'delete';
  timestamp: string;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new subscription.
 */
export async function createSubscription(
  tenantId: string,
  subscription: FhirSubscriptionResource,
): Promise<SubscriptionRecord> {
  const id = uuidv4();

  // Parse criteria — e.g. "Observation?category=laboratory"
  const criteria = subscription.criteria || '';

  // Validate channel
  if (!subscription.channel?.type || !subscription.channel?.endpoint) {
    throw new Error('Subscription channel type and endpoint are required');
  }

  if (subscription.channel.type !== 'rest-hook') {
    throw new Error('Only rest-hook channel type is currently supported');
  }

  const channelEndpoint = subscription.channel.endpoint;
  const channelPayload = subscription.channel.payload || 'application/fhir+json';
  const channelHeaders = subscription.channel.header || [];

  const created = await prisma.fhirSubscription.create({
    data: {
      id,
      tenantId,
      status: 'active',
      reason: subscription.reason || '',
      criteria,
      channelType: subscription.channel.type,
      channelEndpoint,
      channelPayload,
      channelHeaders,
      end: subscription.end ? new Date(subscription.end) : null,
    },
  });

  logger.info('FHIR subscription created', {
    category: 'api',
    tenantId,
    subscriptionId: id,
    criteria,
    endpoint: channelEndpoint,
  } as Record<string, unknown>);

  // Map Prisma record back to SubscriptionRecord shape
  return toSubscriptionRecord(created);
}

/**
 * List all active subscriptions for a tenant.
 */
export async function listSubscriptions(
  tenantId: string,
): Promise<SubscriptionRecord[]> {
  const docs = await prisma.fhirSubscription.findMany({
    where: { tenantId, status: { not: 'off' } },
    take: 200,
    orderBy: { createdAt: 'desc' },
  });

  return docs.map(toSubscriptionRecord);
}

/**
 * Get a single subscription.
 */
export async function getSubscription(
  tenantId: string,
  id: string,
): Promise<SubscriptionRecord | null> {
  const doc = await prisma.fhirSubscription.findFirst({
    where: { tenantId, id },
  });

  return doc ? toSubscriptionRecord(doc) : null;
}

/**
 * Update subscription status.
 */
export async function updateSubscriptionStatus(
  tenantId: string,
  id: string,
  status: SubscriptionRecord['status'],
  error?: string,
): Promise<boolean> {
  // Verify it belongs to this tenant first
  const existing = await prisma.fhirSubscription.findFirst({
    where: { tenantId, id },
  });

  if (!existing) return false;

  await prisma.fhirSubscription.update({
    where: { id },
    data: {
      status,
      error: error || null,
      updatedAt: new Date(),
    },
  });

  return true;
}

/**
 * Delete a subscription (set status to 'off').
 */
export async function deleteSubscription(
  tenantId: string,
  id: string,
): Promise<boolean> {
  return updateSubscriptionStatus(tenantId, id, 'off');
}

// ---------------------------------------------------------------------------
// Notification Dispatch
// ---------------------------------------------------------------------------

/**
 * Notify all matching subscriptions when a resource changes.
 * Called by FHIR create/update operations.
 */
export async function notifySubscribers(
  tenantId: string,
  resourceType: string,
  resourceId: string,
  action: 'create' | 'update' | 'delete',
  resource?: Record<string, unknown>,
): Promise<void> {
  try {
    // Find all active subscriptions that match this resource type
    const subs = await prisma.fhirSubscription.findMany({
      where: {
        tenantId,
        status: 'active',
        criteria: { startsWith: resourceType },
      },
    });

    if (!subs.length) return;

    const notifications: Promise<void>[] = [];

    for (const sub of subs) {
      const record = toSubscriptionRecord(sub);

      // Check expiration
      if (record.end && new Date(record.end) < new Date()) {
        await updateSubscriptionStatus(tenantId, record.id, 'off');
        continue;
      }

      // Check criteria match (simple resource type check for now)
      if (matchesCriteria(record.criteria, resourceType, resource)) {
        notifications.push(
          sendNotification(tenantId, record, {
            subscriptionId: record.id,
            resourceType,
            resourceId,
            action,
            timestamp: new Date().toISOString(),
          }, resource),
        );
      }
    }

    // Fire all notifications concurrently (don't block the main request)
    await Promise.allSettled(notifications);
  } catch (error) {
    // Never let subscription errors break the main operation
    logger.error('Failed to notify subscribers', {
      category: 'api',
      error,
      tenantId,
      resourceType,
      resourceId,
    });
  }
}

/**
 * Check if a resource matches subscription criteria.
 * Criteria format: "ResourceType?param=value&param2=value2"
 */
function matchesCriteria(
  criteria: string,
  resourceType: string,
  resource?: Record<string, unknown>,
): boolean {
  const [criteriaType, queryString] = criteria.split('?');

  // Resource type must match
  if (criteriaType !== resourceType) return false;

  // If no query params, match all resources of this type
  if (!queryString) return true;

  // If we don't have the resource, we can't check criteria
  if (!resource) return true;

  // Parse and check criteria params
  const params = new URLSearchParams(queryString);
  for (const [key, value] of params) {
    const resourceValue = resource[key];
    if (resourceValue === undefined) continue;

    // Simple string match
    if (String(resourceValue) !== value) return false;
  }

  return true;
}

/**
 * Send a notification to a subscriber's endpoint.
 */
async function sendNotification(
  tenantId: string,
  sub: SubscriptionRecord,
  notification: SubscriptionNotification,
  resource?: Record<string, unknown>,
): Promise<void> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': sub.channelPayload || 'application/fhir+json',
    };

    // Add custom headers
    for (const h of sub.channelHeaders) {
      const colonIdx = h.indexOf(':');
      if (colonIdx > 0) {
        headers[h.substring(0, colonIdx).trim()] = h.substring(colonIdx + 1).trim();
      }
    }

    const body = resource
      ? JSON.stringify(resource)
      : JSON.stringify(notification);

    const response = await fetch(sub.channelEndpoint, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      logger.warn('Subscription notification failed', {
        category: 'api',
        subscriptionId: sub.id,
        status: response.status,
        endpoint: sub.channelEndpoint,
      } as Record<string, unknown>);

      // Mark subscription as error after failures
      await updateSubscriptionStatus(tenantId, sub.id, 'error', `HTTP ${response.status}`);
    }

    // Log the notification
    await prisma.fhirSubscriptionLog.create({
      data: {
        tenantId,
        subscriptionId: sub.id,
        resourceType: notification.resourceType,
        resourceId: notification.resourceId,
        action: notification.action,
        status: response.ok ? 'delivered' : 'failed',
        httpStatus: response.status,
        endpoint: sub.channelEndpoint,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Subscription notification error', {
      category: 'api',
      subscriptionId: sub.id,
      error,
    });

    await updateSubscriptionStatus(
      tenantId,
      sub.id,
      'error',
      error instanceof Error ? error.message : 'Notification failed',
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a Prisma FhirSubscription row to the SubscriptionRecord interface.
 */
function toSubscriptionRecord(row: any): SubscriptionRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    status: row.status as SubscriptionRecord['status'],
    reason: row.reason || '',
    criteria: row.criteria || '',
    channelType: row.channelType || 'rest-hook',
    channelEndpoint: row.channelEndpoint || '',
    channelPayload: row.channelPayload || 'application/fhir+json',
    channelHeaders: row.channelHeaders || [],
    end: row.end ? (row.end instanceof Date ? row.end.toISOString() : String(row.end)) : undefined,
    error: row.error || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Convert to FHIR
// ---------------------------------------------------------------------------

/**
 * Convert a subscription record to FHIR Subscription resource.
 */
export function toFhirSubscription(record: SubscriptionRecord): FhirSubscriptionResource {
  return {
    resourceType: 'Subscription',
    id: record.id,
    status: record.status,
    reason: record.reason,
    criteria: record.criteria,
    channel: {
      type: record.channelType as 'rest-hook',
      endpoint: record.channelEndpoint,
      payload: record.channelPayload,
      header: record.channelHeaders,
    },
    end: record.end,
  };
}
