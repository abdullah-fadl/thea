/**
 * Session State Model
 *
 * Persists last session state for session restore:
 * - lastPlatformKey
 * - lastRoute
 * - lastTenantId
 * - lastVisitedAt
 */

export interface SessionState {
  id: string; // UUID

  // User reference
  userId: string;

  // Last session metadata
  lastPlatformKey?: string; // 'sam' | 'thea-health' | 'cvision' | 'edrac'
  lastRoute?: string; // Last visited route
  lastTenantId?: string; // Last active tenant
  lastVisitedAt: Date;

  // Session restore preferences
  autoRestore: boolean; // Whether to auto-restore on login

  // Audit
  createdAt: Date;
  updatedAt: Date;
}
