/**
 * SCM Admin — Roles API
 *
 * GET  /api/imdad/admin/roles — List built-in role templates + custom roles
 * POST /api/imdad/admin/roles — Create a custom role with selected permissions
 *
 * Permission: imdad.admin.permissions.view (GET), imdad.admin.permissions.manage (POST)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { getAllRoleTemplates } from '@/lib/imdad/roles';
import { IMDAD_PERMISSIONS } from '@/lib/imdad/permissions';

// ---------------------------------------------------------------------------
// GET — List role templates + custom roles
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (_req: NextRequest, { tenantId }) => {
    try {
      const builtInRoles = getAllRoleTemplates();

      // Fetch custom roles from the database (if ImdadCustomRole table exists)
      let customRoles: any[] = [];
      try {
        customRoles = await (prisma as any).imdadCustomRole?.findMany?.({
          where: { tenantId, isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }) ?? [];
      } catch {
        // Table may not exist yet; return empty
      }

      return NextResponse.json({
        builtInRoles,
        customRoles,
        totalBuiltIn: builtInRoles.length,
        totalCustom: customRoles.length,
      });
    } catch (error) {
      console.error('[SCM Roles GET]', error);
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

// ---------------------------------------------------------------------------
// POST — Create a custom role
// ---------------------------------------------------------------------------

const createRoleSchema = z.object({
  key: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'key must be lowercase alphanumeric with hyphens'),
  nameEn: z.string().min(1).max(128),
  nameAr: z.string().min(1).max(128),
  descriptionEn: z.string().max(512).optional().default(''),
  descriptionAr: z.string().max(512).optional().default(''),
  permissions: z
    .array(z.string())
    .min(1, 'At least one permission is required'),
});

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }) => {
    try {
      const body = await req.json();
      const parsed = createRoleSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.issues },
          { status: 400 }
        );
      }

      const data = parsed.data;

      // Validate all permission keys exist
      const invalidPerms = data.permissions.filter(
        (p) => !(p in IMDAD_PERMISSIONS)
      );
      if (invalidPerms.length > 0) {
        return NextResponse.json(
          {
            error: 'Invalid permissions',
            details: `Unknown permission keys: ${invalidPerms.join(', ')}`,
          },
          { status: 400 }
        );
      }

      // Check key uniqueness within tenant
      let existing: any = null;
      try {
        existing = await (prisma as any).imdadCustomRole?.findFirst?.({
          where: { tenantId, key: data.key, isDeleted: false },
        });
      } catch {
        // Table may not exist; proceed
      }

      if (existing) {
        return NextResponse.json(
          { error: 'A role with this key already exists' },
          { status: 409 }
        );
      }

      // Create custom role
      let role: any = null;
      try {
        role = await (prisma as any).imdadCustomRole?.create?.({
          data: {
            tenantId,
            key: data.key,
            nameEn: data.nameEn,
            nameAr: data.nameAr,
            descriptionEn: data.descriptionEn,
            descriptionAr: data.descriptionAr,
            permissions: data.permissions,
            builtIn: false,
            createdBy: userId,
          },
        });
      } catch (err: any) {
        // If the table doesn't exist, store in ImdadSystemConfig as fallback
        if (err?.code === 'P2021' || err?.message?.includes('does not exist')) {
          await prisma.imdadSystemConfig.create({
            data: {
              tenantId,
              configKey: `imdad.role.custom.${data.key}`,
              configValue: {
                key: data.key,
                nameEn: data.nameEn,
                nameAr: data.nameAr,
                descriptionEn: data.descriptionEn,
                descriptionAr: data.descriptionAr,
                permissions: data.permissions,
                builtIn: false,
              } as any,
              scope: 'ORGANIZATION',
              createdBy: userId,
              updatedBy: userId,
            } as any,
          });

          role = { key: data.key, ...data, builtIn: false };
        } else {
          throw err;
        }
      }

      // Audit log
      await imdadAudit.log({
        tenantId,
        actorUserId: userId,
        action: 'CREATE',
        resourceType: 'custom_role',
        resourceId: role?.id || data.key,
        boundedContext: 'PLATFORM',
        newData: { ...data },
      });

      return NextResponse.json({ role }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) },
          { status: 400 }
        );
      }
      console.error('[SCM Roles POST]', error);
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }
  },
  {
    platformKey: 'imdad',
    permissionKey: 'imdad.admin.permissions.manage',
  }
);
