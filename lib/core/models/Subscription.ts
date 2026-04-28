/**
 * Subscription Contract Model
 * 
 * Defines the subscription contract for each tenant, controlling:
 * - enabledPlatforms
 * - maxUsers
 * - enabledFeatures
 * - storageLimit
 * - AI quota
 * - branch limits
 */

export type SubscriptionStatus = 'active' | 'blocked' | 'expired';

export interface SubscriptionContract {
  id: string; // UUID
  
  // Tenant reference
  tenantId: string; // ALWAYS from session, never from client
  
  // Platform entitlements
  enabledPlatforms: {
    sam: boolean;
    theaHealth: boolean;
    cvision: boolean;
    edrac: boolean;
    imdad: boolean;
  };
  
  // User limits
  maxUsers: number;
  currentUsers: number; // Computed, not stored
  
  // Feature flags
  enabledFeatures: {
    [featureKey: string]: boolean;
  };
  
  // Resource limits
  storageLimit: number; // in bytes
  aiQuota: {
    monthlyLimit: number;
    currentUsage: number;
    resetDate: Date;
  };
  branchLimits?: {
    maxDepartments: number;
    maxUnits: number;
    maxFloors: number;
  };
  
  // Subscription lifecycle
  status: SubscriptionStatus;
  planType: 'demo' | 'trial' | 'paid' | 'enterprise';
  subscriptionStartsAt: Date;
  subscriptionEndsAt?: Date;
  gracePeriodEndsAt?: Date;
  gracePeriodEnabled: boolean; // Read-only mode during grace period
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Check if subscription is active and allows access
 */
export function isSubscriptionActive(contract: SubscriptionContract | null): boolean {
  if (!contract) return false;
  
  if (contract.status === 'active') {
    // Check if expired
    if (contract.subscriptionEndsAt && new Date() > contract.subscriptionEndsAt) {
      return contract.gracePeriodEnabled && 
             contract.gracePeriodEndsAt && 
             new Date() <= contract.gracePeriodEndsAt;
    }
    return true;
  }
  
  return false;
}

/**
 * Check if subscription allows read-only access (grace period)
 */
export function isReadOnlyMode(contract: SubscriptionContract | null): boolean {
  if (!contract) return false;
  
  if (contract.status === 'expired' || 
      (contract.subscriptionEndsAt && new Date() > contract.subscriptionEndsAt)) {
    return contract.gracePeriodEnabled && 
           contract.gracePeriodEndsAt && 
           new Date() <= contract.gracePeriodEndsAt;
  }
  
  return false;
}
