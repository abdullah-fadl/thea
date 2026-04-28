/**
 * CVision SaaS — Barrel Export
 */

// Tenant management
export {
  type Tenant,
  type TenantAddress,
  type TenantBranding,
  type TenantSubscription,
  type TenantSettings,
  type SubscriptionPlan,
  type SubscriptionStatus,
  PLANS,
  createTenant,
  getTenant,
  updateTenant,
  suspendTenant,
  reactivateTenant,
  listTenants,
  isFeatureEnabled,
  checkEmployeeLimit,
  checkUserLimit,
  getTenantBranding,
  validateTenantAccess,
  getTenantUsage,
  ensureTenantIndexes,
} from './tenant-manager';

// Tenant middleware
export {
  type TenantContext,
  type WithTenantOptions,
  withTenant,
} from './tenant-middleware';

// User management
export {
  type TenantUser,
  type TenantUserRole,
  ROLE_PERMISSIONS,
  createUser,
  inviteUser,
  acceptInvite,
  getUser,
  getUserByEmail,
  updateUser,
  deactivateUser,
  recordLogin,
  getUserPermissions,
  hasPermission,
  hasAnyPermission,
  listTenantUsers,
  ensureUserIndexes,
} from './user-manager';

// Data isolation
export {
  withTenantFilter,
  withTenantFilterActive,
  auditDataIsolation,
  backfillTenantId,
  ensureTenantIdIndexes,
} from './data-isolation';

// Seed
export {
  seedDefaultTenant,
  DEFAULT_TENANT_ID,
} from './seed';

// API Keys
export {
  type APIKey,
  type APIKeyValidation,
  type RateLimitResult,
  API_PERMISSIONS,
  generateAPIKey,
  validateAPIKey,
  listAPIKeys,
  revokeAPIKey,
  getAPIKey,
  checkRateLimit,
  trackAPIUsage,
  getAPIUsageStats,
  hasAPIPermission,
  ensureAPIKeyIndexes,
} from './api-keys';

// Webhooks
export {
  type WebhookSubscription,
  type WebhookEvent,
  WEBHOOK_EVENTS,
  createWebhook,
  listWebhooks,
  getWebhook,
  deleteWebhook,
  updateWebhook,
  fireWebhookEvent,
  deliverWebhook,
  signWebhookPayload,
  verifyWebhookSignature,
  testWebhook,
  getWebhookHistory,
  ensureWebhookIndexes,
} from './webhooks';

// OpenAPI Spec
export { openApiSpec } from './openapi-spec';
