/**
 * Tenant Model
 * 
 * Represents a tenant (customer/organization) with platform entitlements.
 * Entitlements define what platforms the tenant has purchased/access to.
 */
export interface Tenant {
  tenantId: string; // Unique identifier (e.g., 'default', 'tenant-123') - used as tenantKey
  name?: string; // Optional tenant name
  dbName?: string; // Database name for this tenant (e.g., 'thea_tenant__hmg-whh') - if not set, derived from tenantId using generateTenantDbName()
  
  // Platform entitlements (what the tenant has purchased)
  entitlements: {
    sam: boolean;
    health: boolean;
    edrac: boolean;
    cvision: boolean;
    imdad: boolean;
  };
  
  // Integration settings (optional)
  integrations?: {
    samHealth?: {
      enabled: boolean;
      autoTriggerEnabled: boolean;
      severityThreshold: 'low' | 'medium' | 'high' | 'critical';
      engineTimeoutMs: number;
    };
  };
  
  // Tenant lifecycle management
  status: 'active' | 'blocked' | 'expired'; // Tenant status (matches SubscriptionStatus)
  planType: 'demo' | 'trial' | 'paid' | 'enterprise'; // Subscription plan type
  subscriptionEndsAt?: Date; // When subscription expires
  gracePeriodEndsAt?: Date; // Grace period end date
  gracePeriodEnabled: boolean; // Read-only mode during grace period
  maxUsers: number; // Maximum number of users allowed
  
  // Subscription contract reference
  subscriptionContractId?: string; // Reference to SubscriptionContract

  // Organization profile (locked after creation)
  orgTypeId?: string;
  sector?: string;
  countryCode?: string | null;
  orgTypeChangeCount?: number;
  
  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

