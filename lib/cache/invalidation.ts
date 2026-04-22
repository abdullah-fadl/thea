/**
 * Cache Invalidation Helpers
 *
 * Domain-specific invalidation functions that clear the correct set of cache
 * entries when data changes. Call these from POST / PUT / DELETE handlers.
 */

import { cache } from './index';
import { CacheKeys } from './keys';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Booking / OPD
// ---------------------------------------------------------------------------

/** Invalidate dashboard + analytics + scheduling slots after a booking change. */
export async function invalidateOnBookingChange(tenantId: string): Promise<void> {
  const counts: number[] = [];
  counts.push(await cache.deletePattern(`opd:dashboard:${tenantId}`));
  counts.push(await cache.deletePattern(`opd:analytics:${tenantId}:*`));
  counts.push(await cache.deletePattern(`scheduling:slots:${tenantId}:*`));
  const total = counts.reduce((a, b) => a + b, 0);
  logger.info('Cache invalidated for booking change', {
    category: 'system',
    tenantId,
    deletedKeys: total,
  });
}

// ---------------------------------------------------------------------------
// Patient
// ---------------------------------------------------------------------------

/** Invalidate a specific patient record and all search caches for the tenant. */
export async function invalidateOnPatientChange(
  tenantId: string,
  patientId: string,
): Promise<void> {
  await cache.delete(CacheKeys.patient(tenantId, patientId));
  await cache.deletePattern(`patient:search:${tenantId}:*`);
}

// ---------------------------------------------------------------------------
// Department / Structure
// ---------------------------------------------------------------------------

/** Invalidate department list caches when a department is created, updated, or deleted. */
export async function invalidateOnDepartmentChange(tenantId: string): Promise<void> {
  await cache.delete(CacheKeys.departments(tenantId));
  await cache.delete(CacheKeys.departmentsWithDeleted(tenantId));
  await cache.deletePattern(`departments:${tenantId}:floor:*`);
  await cache.deletePattern(`department:${tenantId}:*`);
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

/** Invalidate scheduling resource and slot caches. */
export async function invalidateOnSchedulingChange(tenantId: string): Promise<void> {
  await cache.delete(CacheKeys.schedulingResources(tenantId));
  await cache.deletePattern(`scheduling:resources:${tenantId}:*`);
  await cache.deletePattern(`scheduling:slots:${tenantId}:*`);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** Invalidate dashboard stats when underlying data changes. */
export async function invalidateDashboard(tenantId: string): Promise<void> {
  await cache.deletePattern(`dashboard:stats:*`);
  await cache.delete(CacheKeys.opdCensus(tenantId));
  logger.info('Cache invalidated for dashboard', { category: 'system', tenantId });
}

// ---------------------------------------------------------------------------
// Departments (extended)
// ---------------------------------------------------------------------------

/** Invalidate all department-related caches for a tenant. */
export async function invalidateDepartments(tenantId: string): Promise<void> {
  await invalidateOnDepartmentChange(tenantId);
  await cache.delete(CacheKeys.departmentList(tenantId));
  await cache.delete(CacheKeys.activeDepartments(tenantId));
}

// ---------------------------------------------------------------------------
// Scheduling (extended)
// ---------------------------------------------------------------------------

/** Invalidate all scheduling-related caches for a tenant. */
export async function invalidateScheduling(tenantId: string): Promise<void> {
  await invalidateOnSchedulingChange(tenantId);
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

/** Invalidate provider list and summary caches when a provider changes. */
export async function invalidateProviders(tenantId: string): Promise<void> {
  await cache.delete(CacheKeys.providers(tenantId));
  await cache.delete(CacheKeys.providerList(tenantId));
  await cache.delete(CacheKeys.providerSummary(tenantId));
  await cache.deletePattern(`providers:${tenantId}:*`);
}

// ---------------------------------------------------------------------------
// Specialties
// ---------------------------------------------------------------------------

/** Invalidate specialty list cache. */
export async function invalidateSpecialties(tenantId: string): Promise<void> {
  await cache.delete(CacheKeys.specialtyList(tenantId));
  await cache.deletePattern(`specialties:${tenantId}:*`);
}

// ---------------------------------------------------------------------------
// Full tenant invalidation
// ---------------------------------------------------------------------------

/** Nuclear option: clear every cache key belonging to a tenant. */
export async function invalidateAll(tenantId: string): Promise<void> {
  await cache.deletePattern(`*:${tenantId}:*`);
  await cache.deletePattern(`*:${tenantId}`);
  logger.info('Full cache invalidated for tenant', { category: 'system', tenantId });
}
