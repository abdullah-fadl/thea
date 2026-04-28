// =============================================================================
// Phase 7.2 — Imdad ItemMaster embedding writer
//
// embedImdadItemMaster(id, opts?) fetches the item by id, builds a single
// embedding-input string from name / nameAr / description / descriptionAr /
// genericName / brandName / manufacturer / code (skipping empty values), embeds
// it via the shared default provider, then stores the vector in the new
// "embeddingVec" column with a raw UPDATE.
//
// Idempotent: re-running on the same row overwrites with an identical vector
// (deterministic model + identical input).
//
// Reuses Phase 5.2's EmbeddingsProvider — does NOT introduce a new flag or a
// new provider implementation.
//
// ItemMaster is the procurement catalog. Embeddings unlock cross-vendor item
// equivalence ("find items similar to this one"), formulary substitute lookup,
// and ABC/VED-aware procurement Cedar policies that compare like items.
// =============================================================================

import { prisma as defaultPrisma } from '@/lib/db/prisma';
import { isEnabled } from '@/lib/core/flags';
import { getDefaultProvider } from '../provider';

export interface EmbedImdadItemMasterResult {
  id: string;
  model: string;
  totalTokens: number;
  skipped: false;
}

export interface EmbedImdadItemMasterSkipped {
  id: string;
  reason: string;
  skipped: true;
}

export type EmbedImdadItemMasterOutcome =
  | EmbedImdadItemMasterResult
  | EmbedImdadItemMasterSkipped;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrisma = any;

export interface EmbedImdadItemMasterOptions {
  /** Inject a different PrismaClient (useful for scripts with a direct connection). */
  prismaClient?: AnyPrisma;
}

/**
 * Build the embedding-input text for an ItemMaster row.
 *
 * Formula (skips empty/null fields):
 *   "Code: <code>\nName: <name> | <nameAr>\nGeneric: <genericName>\n
 *    Brand: <brandName>\nManufacturer: <manufacturer>\n
 *    Description: <description> | <descriptionAr>"
 *
 * Exported for unit-testing the formula directly.
 */
export function buildImdadItemMasterEmbeddingInput(item: {
  code?: string | null;
  name?: string | null;
  nameAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  genericName?: string | null;
  brandName?: string | null;
  manufacturer?: string | null;
}): string {
  const lines: string[] = [];
  if (item.code) lines.push(`Code: ${item.code}`);

  const nameParts = [item.name, item.nameAr].filter(Boolean);
  if (nameParts.length > 0) lines.push(`Name: ${nameParts.join(' | ')}`);

  if (item.genericName) lines.push(`Generic: ${item.genericName}`);
  if (item.brandName) lines.push(`Brand: ${item.brandName}`);
  if (item.manufacturer) lines.push(`Manufacturer: ${item.manufacturer}`);

  const descParts = [item.description, item.descriptionAr].filter(Boolean);
  if (descParts.length > 0) lines.push(`Description: ${descParts.join(' | ')}`);

  return lines.join('\n');
}

/**
 * Generate and persist an embedding for a single ImdadItemMaster row.
 *
 * Returns skipped:true when the flag is OFF, the item does not exist, or the
 * combined input is empty. Throws on unexpected errors (e.g. provider failures).
 */
export async function embedImdadItemMaster(
  id: string,
  opts?: EmbedImdadItemMasterOptions,
): Promise<EmbedImdadItemMasterOutcome> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: AnyPrisma = opts?.prismaClient ?? defaultPrisma;

  if (!isEnabled('FF_EMBEDDINGS_ENABLED')) {
    return { id, reason: 'FF_EMBEDDINGS_ENABLED is OFF', skipped: true };
  }

  // May throw EmbeddingsConfigurationError when key is missing — let it propagate.
  const provider = getDefaultProvider();

  const item = await db.imdadItemMaster.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      nameAr: true,
      description: true,
      descriptionAr: true,
      genericName: true,
      brandName: true,
      manufacturer: true,
    },
  });

  if (!item) {
    return { id, reason: 'imdad item master not found', skipped: true };
  }

  const input = buildImdadItemMasterEmbeddingInput(item);
  if (!input || input.trim().length === 0) {
    return { id, reason: 'imdad item master has no embeddable text', skipped: true };
  }

  const result = await provider.embed(input);

  // Raw UPDATE — Prisma does not natively support vector(1536). Column name is
  // quoted camelCase ("embeddingVec") to match this codebase's column naming
  // convention (see migration 20260425000002).
  const vectorLiteral = `[${result.embedding.join(',')}]`;
  await db.$executeRawUnsafe(
    `UPDATE "imdad_item_masters" SET "embeddingVec" = $1::vector WHERE "id" = $2::uuid`,
    vectorLiteral,
    id,
  );

  return {
    id,
    model: result.model,
    totalTokens: result.totalTokens,
    skipped: false,
  };
}
