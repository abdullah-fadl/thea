import { prisma } from '@/lib/db/prisma';
import type { ErGender } from './constants';

function padSequence(value: number, width = 3): string {
  const raw = String(value);
  return raw.length >= width ? raw : raw.padStart(width, '0');
}

/**
 * Generate a temp MRN for unknown patients by atomically incrementing
 * an ErSequence row in PostgreSQL.
 *
 * The `_db` parameter is retained (but ignored) for call-site
 * compatibility during the migration period.
 */
export async function generateTempMrn(_db: any, gender: ErGender): Promise<string> {
  const key = `temp_mrn_${gender}`;

  // We need a tenantId for the ErSequence unique constraint.
  // Temp MRN sequences are global (not tenant-scoped in the original code),
  // so we use a fixed "system" UUID as the tenant placeholder.
  const systemTenantId = '00000000-0000-0000-0000-000000000000';

  const rows = await prisma.$queryRaw<Array<{ current_val: number }>>`
    INSERT INTO er_sequences ("id", "tenant_id", "sequence_key", "current_val", "updated_at")
    VALUES (gen_random_uuid(), ${systemTenantId}::uuid, ${key}, 1, NOW())
    ON CONFLICT ("tenant_id", "sequence_key")
    DO UPDATE SET "current_val" = er_sequences."current_val" + 1, "updated_at" = NOW()
    RETURNING "current_val"
  `;

  const nextValue = rows[0]?.current_val ?? 1;
  const label = gender === 'MALE' ? 'Male' : gender === 'FEMALE' ? 'Female' : 'Unknown';
  return `Unknown_${label}_${padSequence(nextValue)}`;
}

export function getWaitingMinutes(startedAt?: Date | string | null): number {
  if (!startedAt) return 0;
  const started = typeof startedAt === 'string' ? new Date(startedAt) : startedAt;
  return Math.max(0, Math.floor((Date.now() - started.getTime()) / 60000));
}

export function normalizeName(name?: string | null): string {
  return (name || '').trim();
}
