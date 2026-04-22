import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

// =============================================================================
// Base Repository — shared tenant-scoped helpers
// =============================================================================

/**
 * Every domain repository extends this class.
 *
 * - `tenantId` is injected at construction and automatically appended to
 *   every query via `tenantFilter()`.
 * - An optional `tx` (transaction client) can be passed when the caller
 *   needs multiple writes in a single DB transaction.
 *
 * Usage:
 *   const repo = new OpdEncounterRepository(tenantId);
 *   const encounter = await repo.findById(id);
 *
 * Inside a transaction:
 *   await prisma.$transaction(async (tx) => {
 *     const repo = new OpdEncounterRepository(tenantId, tx);
 *     ...
 *   });
 */
export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export abstract class BaseRepository {
  protected readonly db: PrismaClient | TransactionClient;
  protected readonly tenantId: string;

  constructor(tenantId: string, tx?: TransactionClient) {
    this.db = tx ?? prisma;
    this.tenantId = tenantId;
  }

  /** Returns `{ tenantId }` — spread into every `where` clause. */
  protected tenantFilter() {
    return { tenantId: this.tenantId } as const;
  }

  /** Merges tenant filter with additional where conditions. */
  protected where<T extends Record<string, unknown>>(extra: T) {
    return { ...this.tenantFilter(), ...extra };
  }
}
