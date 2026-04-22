/**
 * Safe Tenant Lookup Helpers
 *
 * The `id` column in the `tenants` table is UUID.
 * The `tenantId` column is a string key (e.g. 'thea-owner-dev', 'hmg-whh').
 *
 * When doing `prisma.tenant.findFirst({ where: { OR: [{ tenantId: val }, { id: val }] } })`,
 * if `val` is NOT a valid UUID, PostgreSQL will throw:
 *   "invalid input syntax for type uuid: ..."
 *
 * These helpers build safe where-clauses by only searching `id` when val is a UUID.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Build a Prisma where-clause for finding a tenant by key or UUID.
 * Only includes `{ id: value }` if the value looks like a UUID.
 *
 * Usage:
 *   prisma.tenant.findFirst({ where: tenantWhere(key) })
 *   prisma.tenant.findFirst({ where: { ...tenantWhere(key), status: 'ACTIVE' } })
 */
export function tenantWhere(tenantKeyOrId: string): { OR: { tenantId?: string; id?: string }[] } | { tenantId: string } {
  if (UUID_RE.test(tenantKeyOrId)) {
    return { OR: [{ tenantId: tenantKeyOrId }, { id: tenantKeyOrId }] };
  }
  return { tenantId: tenantKeyOrId };
}
