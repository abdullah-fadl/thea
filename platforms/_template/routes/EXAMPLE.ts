/**
 * EXAMPLE: Platform API Route Handler
 * Copy to: app/api/my-platform/<resource>/route.ts
 *
 * Three rules every platform route must follow:
 *   1. Use `withAuthTenant` — never call prisma directly from the route body
 *      without the guard.  The guard validates JWT, resolves tenantId, and
 *      enforces the platform entitlement check automatically.
 *   2. Declare `platformKey` matching the value registered in
 *      lib/db/platformKey.ts.  This is what triggers the entitlement gate.
 *   3. Emit a standardized domain event after any state-mutating operation
 *      (once Phase 4.2 lands; see the TODO comment below).
 *
 * This file is NOT imported by the application.  It is a scaffold reference.
 */

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
// TODO(phase-4.2): import { emitEvent } from '@/lib/events/emitter';

// ---------------------------------------------------------------------------
// GET /api/my-platform/resource
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (_req, { tenantId }) => {
    // `tenantId` is guaranteed non-null here — the guard resolves it from JWT.
    // The platform entitlement gate has already run; if the tenant is not
    // entitled to 'my_platform', the guard returned 403 before reaching here.

    const rows = await prisma.myPlatform_OrderExtension.findMany({
      where: { tenantId },
      orderBy: { id: 'asc' },
    });

    return NextResponse.json({ data: rows });
  },
  {
    tenantScoped: true,
    // REQUIRED: matches the PlatformKey registered in lib/db/platformKey.ts
    platformKey: 'my_platform' as any, // replace 'as any' with the real union value once registered
    // REQUIRED: granular permission key for RBAC
    permissionKey: 'my_platform.resource.read',
  }
);

// ---------------------------------------------------------------------------
// POST /api/my-platform/resource
// ---------------------------------------------------------------------------
export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    const body = await req.json();

    const created = await prisma.myPlatform_OrderExtension.create({
      data: {
        tenantId,
        coreId: body.coreId,          // FK to core entity — validated by DB constraint
        platformRefCode: body.refCode,
        // …other platform-specific fields
      },
    });

    // TODO(phase-4.2): emit domain event so other modules can react without coupling.
    // await emitEvent({
    //   type: 'my_platform.order_extension.created',
    //   tenantId,
    //   actorId: userId,
    //   payload: { id: created.id, coreId: created.coreId },
    //   schemaVersion: 1,           // versioned — bump when payload shape changes
    // });

    return NextResponse.json({ data: created }, { status: 201 });
  },
  {
    tenantScoped: true,
    platformKey: 'my_platform' as any,
    permissionKey: 'my_platform.resource.write',
  }
);

// ---------------------------------------------------------------------------
// WHERE PLATFORM-SPECIFIC AUTH SITS
//
// The entitlement check (is the tenant subscribed to this platform?) is
// handled entirely by `withAuthTenant` when `platformKey` is declared.
//
// Feature-flag gating within a platform (e.g., beta features) should use
// the isFeatureEnabled() helper from lib/core/flags/index.ts:
//
//   import { isFeatureEnabled, FLAGS } from '@/lib/core/flags';
//   if (!isFeatureEnabled(FLAGS.FF_MY_PLATFORM_BETA_FEATURE)) {
//     return NextResponse.json({ error: 'Not available' }, { status: 404 });
//   }
//
// Do NOT call getTenantEntitlements() or checkSubscription() manually inside
// a route handler — that check belongs in the guard, not in business logic.
// ---------------------------------------------------------------------------
