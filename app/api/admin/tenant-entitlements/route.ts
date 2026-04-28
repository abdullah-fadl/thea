import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';

import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateEntitlementsSchema = z.object({
  entitlements: z.object({
    sam: z.boolean(),
    health: z.boolean(),
    edrac: z.boolean(),
    cvision: z.boolean(),
  }),
});

/**
 * GET /api/admin/tenant-entitlements
 * 
 * DISABLED: Tenant entitlements are now owner-only.
 * This endpoint returns 403 to indicate that tenant admins cannot manage entitlements.
 * 
 * Tenant admins should use /api/owner/tenants/[tenantId]/entitlements (owner-only).
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId, role }) => {
    // This endpoint is authenticated but always returns 403 for non-owner users
    // Owner users should use /api/owner/tenants/[tenantId]/entitlements
    return NextResponse.json(
      {
        error: 'Forbidden',
        message: 'Tenant entitlements can only be managed by Thea Owner. Please use /owner console.'
      },
      { status: 403 }
    );
  }),
  { tenantScoped: false, permissionKey: 'admin.tenant-entitlements.access' }
);

/**
 * PATCH /api/admin/tenant-entitlements
 * 
 * DISABLED: Tenant entitlements are now owner-only.
 * This endpoint returns 403 to indicate that tenant admins cannot manage entitlements.
 * 
 * Tenant admins should use /api/owner/tenants/[tenantId]/entitlements (owner-only).
 */
export const PATCH = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId, role }) => {
    // This endpoint is authenticated but always returns 403 for non-owner users
    // Owner users should use /api/owner/tenants/[tenantId]/entitlements
    return NextResponse.json(
      {
        error: 'Forbidden',
        message: 'Tenant entitlements can only be managed by Thea Owner. Please use /owner console.'
      },
      { status: 403 }
    );
  }),
  { tenantScoped: false, permissionKey: 'admin.tenant-entitlements.access' }
);

