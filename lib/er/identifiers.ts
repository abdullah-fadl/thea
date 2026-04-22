import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

export function formatYyyyMmDd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function formatHhMm(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}${mm}`;
}

export function generateUnknownTempMrn(options?: {
  now?: Date;
  random?: () => number;
}): string {
  const now = options?.now ?? new Date();
  const random = options?.random;

  // XXXX: short random 4 digits, zero-padded.
  // Prefer WebCrypto for stronger randomness (available in modern Node and browsers),
  // fall back to Math.random only if crypto is unavailable.
  let n: number;
  if (typeof random === 'function') {
    n = Math.floor(random() * 10000);
  } else if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    n = Number(buf[0] % 10000);
  } else {
    n = Math.floor(Math.random() * 10000);
  }
  const suffix = String(n).padStart(4, '0');
  return `UN-${formatYyyyMmDd(now)}-${formatHhMm(now)}-${suffix}`;
}

/**
 * Check whether a Prisma error is a unique-constraint violation (P2002).
 * This replaces the former `isMongoDuplicateKeyError` check.
 */
export function isPrismaDuplicateKeyError(err: any): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

/** @deprecated Use isPrismaDuplicateKeyError instead */
export const isMongoDuplicateKeyError = isPrismaDuplicateKeyError;

function padSequence(value: number, width: number): string {
  const raw = String(value);
  return raw.length >= width ? raw : raw.padStart(width, '0');
}

/**
 * Atomically allocate the next ER visit number for a tenant.
 *
 * Uses Prisma's `upsert` on the ErSequence model with a raw SQL
 * increment to guarantee atomicity.
 */
export async function allocateErVisitNumber(
  _db: any,
  tenantId: string
): Promise<string> {
  const key = `er_visit_${tenantId}`;

  // Use raw SQL for atomic increment (Postgres)
  // Column names must match Prisma field names (camelCase, no @map overrides)
  const rows = await prisma.$queryRaw<Array<{ currentVal: number }>>`
    INSERT INTO er_sequences ("id", "tenantId", "sequenceKey", "currentVal", "updatedAt")
    VALUES (gen_random_uuid(), ${tenantId}::uuid, ${key}, 1, NOW())
    ON CONFLICT ("tenantId", "sequenceKey")
    DO UPDATE SET "currentVal" = er_sequences."currentVal" + 1, "updatedAt" = NOW()
    RETURNING "currentVal"
  `;

  const nextValue = rows[0]?.currentVal ?? 1;
  return `ER-${padSequence(nextValue, 5)}`;
}

export async function retryOnDuplicateKey<T>(options: {
  maxAttempts?: number;
  generate: () => string;
  run: (value: string, attempt: number) => Promise<T>;
}): Promise<{ value: string; result: T; attempts: number }> {
  const maxAttempts = options.maxAttempts ?? 5;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const value = options.generate();
    try {
      const result = await options.run(value, attempt);
      return { value, result, attempts: attempt };
    } catch (err: any) {
      lastErr = err;
      if (isPrismaDuplicateKeyError(err) && attempt < maxAttempts) {
        continue;
      }
      throw err;
    }
  }

  // Should be unreachable due to throw in loop, but keep deterministic.
  throw lastErr ?? new Error('Retry failed');
}
