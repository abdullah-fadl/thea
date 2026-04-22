import { createHash } from 'crypto';

/**
 * Generate database name for a tenant
 * 
 * Unified naming pattern: thea_tenant__<tenantKey>
 * 
 * MongoDB Atlas has a maximum database name length of 64 bytes.
 * This function uses the unified pattern: thea_tenant__<tenantKey>
 * 
 * @param tenantId - Tenant identifier
 * @returns Database name: thea_tenant__<tenantId>
 */
export function generateTenantDbName(tenantId: string): string {
  const PREFIX = 'thea_tenant__'; // 13 chars
  const MAX_LENGTH = 64; // MongoDB Atlas limit
  
  // Validate tenantId length
  const maxTenantIdLength = MAX_LENGTH - PREFIX.length; // 51 chars
  if (tenantId.length > maxTenantIdLength) {
    throw new Error(`Tenant ID "${tenantId}" is too long (max ${maxTenantIdLength} chars for database name)`);
  }

  return `${PREFIX}${tenantId}`;
}

/**
 * Get tenant database name from tenant record or generate one
 * 
 * @param tenant - Tenant record (may have dbName field)
 * @param tenantId - Tenant identifier (fallback)
 * @returns Database name
 */
export function getTenantDbName(tenant: any, tenantId: string): string {
  // If tenant has dbName, use it (preferred)
  if (tenant?.dbName && typeof tenant.dbName === 'string') {
    return tenant.dbName;
  }

  // Otherwise, generate one
  return generateTenantDbName(tenantId);
}

