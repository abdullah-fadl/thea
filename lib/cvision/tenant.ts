/**
 * CVision (HR OS) - Tenant Helpers
 * 
 * Thin wrapper around existing tenant primitives.
 * Ensures consistent tenant extraction for CVision module.
 */

import { getTenantDbByKey } from '@/lib/cvision/infra';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

// =============================================================================
// Tenant Database
// =============================================================================

/**
 * Get tenant database connection for CVision operations
 * 
 * @param tenantId - The tenant identifier (from session, NEVER from request body)
 * @returns MongoDB database instance for the tenant
 */
export async function getCVisionTenantDb(tenantId: string): Promise<Db> {
  if (!tenantId) {
    throw new Error('tenantId is required');
  }
  return getTenantDbByKey(tenantId);
}

// =============================================================================
// Tenant ID Extraction
// =============================================================================

/**
 * Extract tenant ID from auth context
 * This is the ONLY safe way to get tenantId for CVision operations
 * 
 * CRITICAL: Never extract tenantId from request body or URL params
 * Always use the session/auth context which is validated server-side
 */
export function extractTenantId(authContext: {
  tenantId?: string;
  activeTenantId?: string;
}): string {
  // Prefer activeTenantId (selected tenant) over tenantId (default tenant)
  const tenantId = authContext.activeTenantId || authContext.tenantId;
  
  if (!tenantId) {
    throw new Error('No tenant context available');
  }
  
  return tenantId;
}

// =============================================================================
// Tenant Validation
// =============================================================================

/**
 * Validate that a record belongs to the specified tenant
 */
export function validateRecordTenant(
  record: { tenantId?: string } | null | undefined,
  expectedTenantId: string
): boolean {
  if (!record) {
    return false;
  }
  return record.tenantId === expectedTenantId;
}

/**
 * Create a tenant-scoped filter for MongoDB queries
 * Always use this to ensure tenant isolation in queries
 */
export function createTenantScopedFilter(
  tenantId: string,
  additionalFilter?: Record<string, any>
): Record<string, any> {
  const baseFilter: Record<string, any> = {
    tenantId,
    deletedAt: null, // Exclude soft-deleted records by default
  };
  
  if (additionalFilter) {
    return { ...baseFilter, ...additionalFilter };
  }
  
  return baseFilter;
}

/**
 * Create a tenant-scoped filter that includes soft-deleted records
 */
export function createTenantScopedFilterWithDeleted(
  tenantId: string,
  additionalFilter?: Record<string, any>
): Record<string, any> {
  const baseFilter: Record<string, any> = {
    tenantId,
  };
  
  if (additionalFilter) {
    return { ...baseFilter, ...additionalFilter };
  }
  
  return baseFilter;
}

// =============================================================================
// Tenant Context Types
// =============================================================================

export interface CVisionTenantContext {
  tenantId: string;
  userId: string;
  role: string;
  departmentId?: string;
  user?: {
    email?: string;
    name?: string;
  };
}

/**
 * Build CVision tenant context from auth session
 */
export function buildCVisionTenantContext(session: {
  tenantId?: string;
  activeTenantId?: string;
  userId?: string;
  role?: string;
  departmentId?: string;
  user?: {
    email?: string;
    name?: string;
  };
}): CVisionTenantContext {
  const tenantId = extractTenantId(session);
  
  if (!session.userId) {
    throw new Error('userId is required');
  }
  
  if (!session.role) {
    throw new Error('role is required');
  }
  
  return {
    tenantId,
    userId: session.userId,
    role: session.role,
    departmentId: session.departmentId,
    user: session.user,
  };
}
