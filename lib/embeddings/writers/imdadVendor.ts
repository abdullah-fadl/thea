// =============================================================================
// Phase 7.2 — Imdad Vendor embedding writer
//
// embedImdadVendor(id, opts?) fetches the vendor by id, builds a single
// embedding-input string from name / nameAr / type / city / country / crNumber
// / paymentTerms / code (skipping empty values), embeds it via the shared
// default provider, then stores the vector in the new "embeddingVec" column
// with a raw UPDATE.
//
// Idempotent: re-running on the same row overwrites with an identical vector
// (deterministic model + identical input).
//
// Reuses Phase 5.2's EmbeddingsProvider — does NOT introduce a new flag or a
// new provider implementation.
//
// Vendor embeddings power semantic supplier search (e.g. "saudi medical-
// equipment supplier with sfda license"), procurement gap analysis, and the
// auto-reorder agent's substitute-vendor lookup.
// =============================================================================

import { prisma as defaultPrisma } from '@/lib/db/prisma';
import { isEnabled } from '@/lib/core/flags';
import { getDefaultProvider } from '../provider';

export interface EmbedImdadVendorResult {
  id: string;
  model: string;
  totalTokens: number;
  skipped: false;
}

export interface EmbedImdadVendorSkipped {
  id: string;
  reason: string;
  skipped: true;
}

export type EmbedImdadVendorOutcome =
  | EmbedImdadVendorResult
  | EmbedImdadVendorSkipped;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrisma = any;

export interface EmbedImdadVendorOptions {
  /** Inject a different PrismaClient (useful for scripts with a direct connection). */
  prismaClient?: AnyPrisma;
}

/**
 * Build the embedding-input text for a Vendor row.
 *
 * Formula (skips empty/null fields):
 *   "Code: <code>\nName: <name> | <nameAr>\nType: <type>\n
 *    Location: <city>, <country>\nCR: <crNumber>\n
 *    Payment Terms: <paymentTerms>"
 *
 * The Vendor model has no description/services columns; this is the highest-
 * signal subset of the registry fields.
 *
 * Exported for unit-testing the formula directly.
 */
export function buildImdadVendorEmbeddingInput(vendor: {
  code?: string | null;
  name?: string | null;
  nameAr?: string | null;
  type?: string | null;
  country?: string | null;
  city?: string | null;
  crNumber?: string | null;
  paymentTerms?: string | null;
}): string {
  const lines: string[] = [];
  if (vendor.code) lines.push(`Code: ${vendor.code}`);

  const nameParts = [vendor.name, vendor.nameAr].filter(Boolean);
  if (nameParts.length > 0) lines.push(`Name: ${nameParts.join(' | ')}`);

  if (vendor.type) lines.push(`Type: ${vendor.type}`);

  const locationParts = [vendor.city, vendor.country].filter(Boolean);
  if (locationParts.length > 0) lines.push(`Location: ${locationParts.join(', ')}`);

  if (vendor.crNumber) lines.push(`CR: ${vendor.crNumber}`);
  if (vendor.paymentTerms) lines.push(`Payment Terms: ${vendor.paymentTerms}`);

  return lines.join('\n');
}

/**
 * Generate and persist an embedding for a single ImdadVendor row.
 *
 * Returns skipped:true when the flag is OFF, the vendor does not exist, or the
 * combined input is empty. Throws on unexpected errors (e.g. provider failures).
 */
export async function embedImdadVendor(
  id: string,
  opts?: EmbedImdadVendorOptions,
): Promise<EmbedImdadVendorOutcome> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: AnyPrisma = opts?.prismaClient ?? defaultPrisma;

  if (!isEnabled('FF_EMBEDDINGS_ENABLED')) {
    return { id, reason: 'FF_EMBEDDINGS_ENABLED is OFF', skipped: true };
  }

  // May throw EmbeddingsConfigurationError when key is missing — let it propagate.
  const provider = getDefaultProvider();

  const vendor = await db.imdadVendor.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      nameAr: true,
      type: true,
      country: true,
      city: true,
      crNumber: true,
      paymentTerms: true,
    },
  });

  if (!vendor) {
    return { id, reason: 'imdad vendor not found', skipped: true };
  }

  const input = buildImdadVendorEmbeddingInput(vendor);
  if (!input || input.trim().length === 0) {
    return { id, reason: 'imdad vendor has no embeddable text', skipped: true };
  }

  const result = await provider.embed(input);

  // Raw UPDATE — Prisma does not natively support vector(1536). Column name is
  // quoted camelCase ("embeddingVec") to match this codebase's column naming
  // convention (see migration 20260425000002).
  const vectorLiteral = `[${result.embedding.join(',')}]`;
  await db.$executeRawUnsafe(
    `UPDATE "imdad_vendors" SET "embeddingVec" = $1::vector WHERE "id" = $2::uuid`,
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
