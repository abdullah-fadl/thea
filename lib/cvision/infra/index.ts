/**
 * CVision Infrastructure Layer
 * Single entry point for shared infrastructure
 */

// Auth wrapper
export {
  withCVisionAuth,
  withAuthTenant,
  type CVisionAuthContext,
  type CVisionHandler
} from './withAuth';

// Audited auth wrapper (auto-logs mutations)
export { withAuditedAuth, type AuditedAuthOptions } from './withAuditedAuth';

// Database
export { getTenantDb, getTenantDbByKey } from './db';

// Auth utilities
export {
  verifyToken,
  validateSession,
  getSessionFromRequest,
  requireAuth,
  type AuthenticatedUser
} from './auth';

// Utils
export { cn } from './utils';
