import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRoleAsync } from '@/lib/auth/requireRole';
import * as structureService from '@/lib/services/structureService';
import { getAuthContext } from '@/lib/auth/requireRole';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

// Validation schemas
const createFloorSchema = z.object({
  number: z.string().min(1),
  name: z.string().optional(),
  label_en: z.string().min(1),
  label_ar: z.string().min(1),
});

// GET - List all floors
export const GET = withErrorHandler(async (request: NextRequest) => {
    const authResult = await requireRoleAsync(request, ['admin', 'supervisor', 'staff', 'viewer']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // GOLDEN RULE: tenantId must ALWAYS come from session
    const { requireTenantId } = await import('@/lib/tenant');
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;
    const { searchParams } = new URL(request.url);
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    if (includeDeleted) {
      // Read all floors (including inactive) via Prisma raw SQL
      // The structureService uses raw SQL for floors since there's no dedicated Floor Prisma model
      const floors: any[] = await prisma.$queryRaw`
        SELECT * FROM floors
        WHERE ("tenantId" = ${tenantId} OR "tenantId" IS NULL OR "tenantId" = '')
        ORDER BY number ASC
      `;

      const formattedFloors = floors.map((floor: any) => ({
        id: floor.id,
        number: floor.number,
        name: floor.name,
        key: floor.key,
        label_en: floor.label_en,
        label_ar: floor.label_ar,
        active: floor.active !== false,
        deletedAt: floor.deletedAt,
        createdAt: floor.createdAt,
        updatedAt: floor.updatedAt,
        createdBy: floor.createdBy,
        updatedBy: floor.updatedBy,
      }));

      return NextResponse.json({ success: true, data: formattedFloors });
    }

    const floors = await structureService.getAllFloors(tenantId);
    return NextResponse.json({ success: true, data: floors });
});

// POST - Create floor
export const POST = withErrorHandler(async (request: NextRequest) => {
    const authResult = await getAuthContext(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission: admin.structure-management.create
    const user = await prisma.user.findFirst({ where: { id: authResult.userId } });
    const userPermissions = user?.permissions || [];

    if (
      !userPermissions.includes('admin.structure-management.create') &&
      !userPermissions.includes('admin.users')
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const v = validateBody(body, createFloorSchema);
    if ('error' in v) return v.error;
    const validatedData = v.data;

    // GOLDEN RULE: tenantId must ALWAYS come from session
    const { requireTenantId } = await import('@/lib/tenant');
    const tenantIdResult = await requireTenantId(request);
    if (tenantIdResult instanceof NextResponse) {
      return tenantIdResult;
    }
    const tenantId = tenantIdResult;
    const floor = await structureService.createFloor({
      number: validatedData.number,
      name: validatedData.name,
      label_en: validatedData.label_en,
      label_ar: validatedData.label_ar,
      createdBy: authResult.userId,
      tenantId: tenantId, // Always set tenantId on creation
    });

    return NextResponse.json({ success: true, data: floor }, { status: 201 });
});
