/**
 * EXAMPLE: Platform Entitlement Module
 * Copy to: lib/my-platform/entitlement.ts
 *
 * Purpose:
 *   Expose a single `isMyPlatformEnabled(ctx)` function that route handlers,
 *   middleware, and background jobs can call without knowing whether the check
 *   is backed by a feature flag, a DB column, or a subscription contract.
 *
 * This file is NOT imported by the application.  It is a scaffold reference.
 */

import { getTenantEntitlements } from '@/lib/entitlements';
import { isFeatureEnabled, FLAGS } from '@/lib/core/flags';

// ---------------------------------------------------------------------------
// Context type — mirrors what withAuthTenant provides to handlers
// ---------------------------------------------------------------------------
interface EntitlementContext {
  tenantId: string;
}

// ---------------------------------------------------------------------------
// isMyPlatformEnabled
//
// Returns true only when BOTH conditions hold:
//   1. The FF_MY_PLATFORM_ENTITLEMENT feature flag is ON (allows gradual
//      rollout and emergency kill-switch without a deploy).
//   2. The tenant has `entitlementMyPlatform = true` in the DB.
//
// When the flag is OFF, this always returns false — useful for disabling
// an entire platform for maintenance without touching the DB.
//
// Replace 'FF_MY_PLATFORM_ENTITLEMENT' with the actual flag name once
// registered in lib/core/flags/index.ts.
// ---------------------------------------------------------------------------
export async function isMyPlatformEnabled(ctx: EntitlementContext): Promise<boolean> {
  // Gate 1: feature flag (environment-controlled, fast)
  if (!isFeatureEnabled(FLAGS.FF_MY_PLATFORM_ENTITLEMENT as any)) {
    return false;
  }

  // Gate 2: tenant DB entitlement (subscription-controlled)
  const entitlements = await getTenantEntitlements(ctx.tenantId);
  if (!entitlements) return false;

  // Replace 'myPlatform' with the key added to PlatformEntitlements interface
  return entitlements.myPlatform === true;
}

// ---------------------------------------------------------------------------
// HOW withAuthTenant uses this:
//
// You do NOT call isMyPlatformEnabled directly in route handlers.
// Instead, declare `platformKey: 'my_platform'` in the withAuthTenant options.
// The guard maps PlatformKey → entitlement key and calls getTenantEntitlements
// internally (see lib/core/guards/withAuthTenant.ts).
//
// Call isMyPlatformEnabled directly only from:
//   - Background jobs / cron tasks that don't go through a route handler
//   - Middleware decisions outside withAuthTenant's scope
//   - Pre-flight checks in CLI scripts (e.g., seed scripts)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// HOW TO REGISTER THE FLAG
//
// In lib/core/flags/index.ts, add:
//
//   FF_MY_PLATFORM_ENTITLEMENT: 'THEA_FF_MY_PLATFORM_ENTITLEMENT',
//
// In .env.example, add:
//
//   # MyPlatform — set to true to enable platform entitlement checks
//   THEA_FF_MY_PLATFORM_ENTITLEMENT=false
// ---------------------------------------------------------------------------
