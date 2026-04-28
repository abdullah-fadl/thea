/**
 * Usage Quota Model
 * 
 * Tracks usage quotas for demo/trial accounts with support for:
 * - Group-level quotas (shared across users in a group)
 * - User-level quotas (individual user limits)
 * 
 * Quota resolution priority: user > group > no limit
 */

export interface UsageQuota {
  id: string; // UUID

  // Tenant isolation
  tenantId: string; // ALWAYS from session, never from user/body/query

  // Scope
  scopeType: 'group' | 'user';
  scopeId: string; // groupId or userId

  // Feature
  featureKey: string; // e.g., 'policy.search', 'policy.view', 'policy.export'

  // Limits
  limit: number; // Maximum allowed uses
  used: number; // Current usage count (atomically incremented)

  // Status
  status: 'active' | 'locked'; // 'locked' means quota is disabled/enforced

  // Time-based expiry (optional)
  startsAt?: Date; // When quota becomes active
  endsAt?: Date; // When quota expires (optional)

  // Lock status
  lockedAt?: Date; // When quota was locked

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Quota resolution result
 */
export interface QuotaResolution {
  quota: UsageQuota | null;
  scopeType: 'user' | 'group' | null;
  available: number; // limit - used (0 if quota exists and used >= limit)
  exceeded: boolean; // true if used >= limit
}
