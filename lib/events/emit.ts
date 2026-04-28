import { isEnabled } from '@/lib/core/flags';
import { getSchema } from './registry';
import { prisma as defaultPrisma } from '@/lib/db/prisma';

// =============================================================================
// emit() — Transactional domain event writer
//
// Behaviour matrix:
//   FF_EVENT_BUS_ENABLED OFF  → returns { skipped: true }, zero DB/NOTIFY calls
//   FF_EVENT_BUS_ENABLED ON + unregistered eventName+version → throws EventNotRegistered
//   FF_EVENT_BUS_ENABLED ON + invalid payload (schema mismatch) → throws ZodError, no row written
//   FF_EVENT_BUS_ENABLED ON + valid payload → inserts row, pg_notify, returns { id, sequence }
//
// Transactional use: pass the `prisma` option with the caller's transaction
// client so the insert is atomic with the surrounding business write.
// =============================================================================

export interface EmitArgs {
  eventName: string;
  version: number;
  tenantId: string;
  aggregate: string;
  aggregateId: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
  /** Pass a Prisma transaction client to make the emit atomic with a business write. */
  prisma?: typeof defaultPrisma;
}

export type EmitResult =
  | { skipped: true }
  | { id: string; sequence: bigint };

export async function emit(args: EmitArgs): Promise<EmitResult> {
  if (!isEnabled('FF_EVENT_BUS_ENABLED')) {
    return { skipped: true };
  }

  // Throws EventNotRegistered if eventName+version is unknown
  const schema = getSchema(args.eventName, args.version);

  // Throws ZodError if payload doesn't match the registered schema
  // If this throws, no row is written (validation happens before the insert)
  const parsed = schema.payloadSchema.parse(args.payload);

  const db = args.prisma ?? defaultPrisma;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const record = await (db as any).eventRecord.create({
    data: {
      tenantId: args.tenantId,
      eventName: args.eventName,
      version: args.version,
      aggregate: args.aggregate,
      aggregateId: args.aggregateId,
      payload: parsed,
      metadata: args.metadata ?? null,
      emittedAt: new Date(),
    },
    select: { id: true, sequence: true },
  });

  // pg_notify is a delivery hint for the LISTEN loop in subscribe.ts.
  // Errors here must NOT fail the emit — the event is already durably persisted.
  // The LISTEN subscriber can always replay from the events table if NOTIFY was missed.
  try {
    const notifyPayload = JSON.stringify({
      id: record.id,
      eventName: args.eventName,
      version: args.version,
      tenantId: args.tenantId,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).$executeRaw`SELECT pg_notify('thea_events', ${notifyPayload})`;
  } catch {
    // intentionally swallowed — NOTIFY is best-effort
  }

  return { id: record.id as string, sequence: record.sequence as bigint };
}
