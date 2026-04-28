/**
 * SCM Admin — Permissions Matrix API
 *
 * GET /api/imdad/admin/permissions
 *
 * Returns the full SCM permissions matrix organized by module,
 * along with all role templates and their permission assignments.
 *
 * Permission: imdad.admin.permissions.view
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import {
  IMDAD_PERMISSIONS,
  IMDAD_MODULE_LABELS,
  getImdadPermissionsByModule,
} from '@/lib/imdad/permissions';
import { getAllRoleTemplates } from '@/lib/imdad/roles';

// ---------------------------------------------------------------------------
// GET — Full permissions matrix + role templates
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (_req: NextRequest, { tenantId }) => {
    try {
      const permissionsByModule = getImdadPermissionsByModule();
      const roleTemplates = getAllRoleTemplates();

      return NextResponse.json({
        permissions: IMDAD_PERMISSIONS,
        permissionsByModule,
        moduleLabels: IMDAD_MODULE_LABELS,
        roleTemplates,
        totalPermissions: Object.keys(IMDAD_PERMISSIONS).length,
        totalRoles: roleTemplates.length,
      });
    } catch (error) {
      console.error('[SCM Permissions GET]', error);
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }
  },
  {
    platformKey: 'imdad',
    permissionKey: 'imdad.admin.permissions.view',
  }
);
