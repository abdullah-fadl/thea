/**
 * Hard Guard: Block writes outside tenant DB
 * 
 * CRITICAL ARCHITECTURAL RULE:
 * - ALL writes/reads must go to tenant DB only: thea_tenant__<tenantId>
 * - NO usage of hospital_ops / policy_system / local / etc.
 */

/**
 * Assert that database name is a valid tenant database
 * 
 * @param dbName - Database name to validate
 * @throws Error if database name is not a tenant database
 */
export function assertTenantDatabase(dbName: string): void {
  if (!dbName.startsWith('thea_tenant__')) {
    throw new Error(
      `[HARD_GUARD] BLOCKED_WRITE_OUTSIDE_TENANT: Database "${dbName}" is not a tenant database. ` +
      `All operations must use tenant databases (thea_tenant__<tenantId>). ` +
      `Use getTenantCollection() instead of getCollection().`
    );
  }
}

/**
 * Check if a collection access should be blocked
 * 
 * @param collectionName - Collection name being accessed
 * @param dbName - Database name (optional, for validation)
 * @returns true if access should be blocked
 */
export function shouldBlockCollectionAccess(collectionName: string, dbName?: string): boolean {
  // If dbName provided, check it's a tenant DB
  if (dbName && !dbName.startsWith('thea_tenant__')) {
    return true;
  }
  
  // Block access to legacy collections if using getCollection() directly
  // This is a soft check - the hard guard is in getTenantDbFromRequest
  return false;
}
