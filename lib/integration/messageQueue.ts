/**
 * Integration Message Queue
 *
 * Manages the flow of messages between Thea EHR and connected instruments:
 *  - Incoming: parse -> validate -> route to handler -> log
 *  - Outgoing: build -> queue -> send -> track delivery
 *  - Failed: retry with exponential backoff (3 retries max)
 *  - Audit: all messages logged in integration_messages table
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import type {
  IntegrationMessage,
  MessageDirection,
  MessageProtocol,
  MessageStatus,
} from './hl7/types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 5000; // 5s, 10s, 20s (exponential)

// ---------------------------------------------------------------------------
// Message Logging
// ---------------------------------------------------------------------------

/**
 * Log an integration message to the audit table.
 */
export async function logMessage(
  tenantId: string,
  params: {
    direction: MessageDirection;
    protocol: MessageProtocol;
    messageType: string;
    instrumentId: string;
    rawMessage: string;
    parsedData?: Record<string, unknown>;
    status: MessageStatus;
    errorMessage?: string;
  },
): Promise<IntegrationMessage> {
  const row = await prisma.integrationMessage.create({
    data: {
      tenantId,
      direction: params.direction,
      protocol: params.protocol,
      messageType: params.messageType,
      instrumentId: params.instrumentId,
      rawMessage: params.rawMessage,
      parsedData: (params.parsedData ?? undefined) as unknown as Prisma.InputJsonValue,
      status: params.status,
      errorMessage: params.errorMessage,
      retryCount: 0,
      receivedAt: new Date(),
    },
  });

  return rowToMessage(row);
}

/**
 * Update message status after processing.
 */
export async function updateMessageStatus(
  tenantId: string,
  messageId: string,
  status: MessageStatus,
  extra?: { errorMessage?: string; parsedData?: Record<string, unknown> },
): Promise<void> {
  const data: Record<string, unknown> = { status };
  if (status === 'PROCESSED' || status === 'FAILED') {
    data.processedAt = new Date();
  }
  if (extra?.errorMessage) data.errorMessage = extra.errorMessage;
  if (extra?.parsedData) data.parsedData = extra.parsedData;

  await prisma.integrationMessage.updateMany({
    where: { id: messageId, tenantId },
    data,
  });
}

// ---------------------------------------------------------------------------
// Retry Logic
// ---------------------------------------------------------------------------

/**
 * Mark a message for retry. Increments retry count and sets status.
 * Returns false if max retries exceeded.
 */
export async function markForRetry(
  tenantId: string,
  messageId: string,
  errorMessage: string,
): Promise<boolean> {
  const msg = await prisma.integrationMessage.findFirst({
    where: { id: messageId, tenantId },
    select: { retryCount: true },
  });

  if (!msg) return false;

  const currentRetry = (msg.retryCount || 0) + 1;

  if (currentRetry > MAX_RETRIES) {
    await updateMessageStatus(tenantId, messageId, 'FAILED', {
      errorMessage: `Max retries exceeded. Last error: ${errorMessage}`,
    });
    return false;
  }

  await prisma.integrationMessage.updateMany({
    where: { id: messageId, tenantId },
    data: {
      status: 'RETRY',
      errorMessage,
      retryCount: currentRetry,
      nextRetryAt: new Date(Date.now() + RETRY_BASE_DELAY_MS * Math.pow(2, currentRetry - 1)),
    },
  });

  return true;
}

/**
 * Get messages that are due for retry.
 */
export async function getRetryableMessages(
  tenantId: string,
  limit: number = 10,
): Promise<IntegrationMessage[]> {
  const rows = await prisma.integrationMessage.findMany({
    where: {
      tenantId,
      status: 'RETRY',
      retryCount: { lte: MAX_RETRIES },
      nextRetryAt: { lte: new Date() },
    },
    orderBy: { nextRetryAt: 'asc' },
    take: limit,
  });

  return rows.map(rowToMessage);
}

// ---------------------------------------------------------------------------
// Message Querying (for admin UI)
// ---------------------------------------------------------------------------

export interface MessageFilter {
  direction?: MessageDirection;
  protocol?: MessageProtocol;
  status?: MessageStatus;
  instrumentId?: string;
  messageType?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

export async function queryMessages(
  tenantId: string,
  filter: MessageFilter,
  page: number = 1,
  limit: number = 50,
): Promise<{ messages: IntegrationMessage[]; total: number }> {
  const where: Record<string, unknown> = { tenantId };

  if (filter.direction) where.direction = filter.direction;
  if (filter.protocol) where.protocol = filter.protocol;
  if (filter.status) where.status = filter.status;
  if (filter.instrumentId) where.instrumentId = filter.instrumentId;
  if (filter.messageType) where.messageType = filter.messageType;

  if (filter.startDate || filter.endDate) {
    const dateFilter: Record<string, Date> = {};
    if (filter.startDate) dateFilter.gte = filter.startDate;
    if (filter.endDate) dateFilter.lte = filter.endDate;
    where.receivedAt = dateFilter;
  }

  if (filter.search) {
    where.OR = [
      { messageType: { contains: filter.search, mode: 'insensitive' } },
      { instrumentId: { contains: filter.search, mode: 'insensitive' } },
      { rawMessage: { contains: filter.search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.integrationMessage.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.integrationMessage.count({ where }),
  ]);

  return { messages: rows.map(rowToMessage), total };
}

// ---------------------------------------------------------------------------
// Instrument Management
// ---------------------------------------------------------------------------

export async function updateInstrumentHeartbeat(
  tenantId: string,
  instrumentId: string,
  status: 'ONLINE' | 'OFFLINE' | 'ERROR' = 'ONLINE',
): Promise<void> {
  await prisma.instrument.updateMany({
    where: { id: instrumentId, tenantId },
    data: { status, lastHeartbeat: new Date(), updatedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export async function getMessageStats(
  tenantId: string,
  since?: Date,
): Promise<{
  total: number;
  received: number;
  processed: number;
  failed: number;
  retry: number;
  byProtocol: Record<string, number>;
}> {
  const where: Record<string, unknown> = { tenantId };
  if (since) where.receivedAt = { gte: since };

  // Use groupBy to replicate the MongoDB aggregation
  const grouped = await prisma.integrationMessage.groupBy({
    by: ['status', 'protocol'],
    where,
    _count: { _all: true },
  });

  const stats = {
    total: 0,
    received: 0,
    processed: 0,
    failed: 0,
    retry: 0,
    byProtocol: {} as Record<string, number>,
  };

  for (const row of grouped) {
    const count = row._count._all;
    stats.total += count;

    switch (row.status) {
      case 'RECEIVED': stats.received += count; break;
      case 'PROCESSED': stats.processed += count; break;
      case 'FAILED': stats.failed += count; break;
      case 'RETRY': stats.retry += count; break;
    }

    const protocol = row.protocol ?? 'UNKNOWN';
    stats.byProtocol[protocol] = (stats.byProtocol[protocol] || 0) + count;
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Internal helper — map Prisma row to IntegrationMessage interface
// ---------------------------------------------------------------------------

function rowToMessage(row: any): IntegrationMessage {
  return {
    id: row.id,
    tenantId: row.tenantId,
    direction: row.direction as MessageDirection,
    protocol: row.protocol as MessageProtocol,
    messageType: row.messageType ?? '',
    instrumentId: row.instrumentId ?? '',
    rawMessage: row.rawMessage ?? '',
    parsedData: row.parsedData as Record<string, unknown> | undefined,
    status: row.status as MessageStatus,
    errorMessage: row.errorMessage ?? undefined,
    retryCount: row.retryCount,
    receivedAt: row.receivedAt ?? row.createdAt,
    processedAt: row.processedAt ?? undefined,
  };
}
