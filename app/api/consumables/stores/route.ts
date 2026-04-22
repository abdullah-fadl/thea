import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';

// Cast for new consumable models not yet in generated Prisma client
const db = prisma as Record<string, any>;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const search = req.nextUrl.searchParams.get('search') || '';
    const status = req.nextUrl.searchParams.get('status') || 'ACTIVE';

    const where: any = { tenantId };
    if (status !== 'ALL') where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const stores = await db.consumableStore.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 500,
    });

    return NextResponse.json({ stores });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);

const createStoreSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  locationType: z.enum(['DEPARTMENT', 'FLOOR', 'UNIT', 'CRASH_CART']),
  locationRef: z.string().optional(),
  parLevel: z.number().int().min(0).optional(),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();
    const v = validateBody(body, createStoreSchema);
    if ('error' in v) return v.error;

    const existing = await db.consumableStore.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const code = `STR-${String(existing.length + 1).padStart(3, '0')}`;
    const now = new Date();

    const store = await db.consumableStore.create({
      data: {
        id: uuidv4(),
        tenantId,
        code,
        name: body.name,
        nameAr: body.nameAr || null,
        locationType: body.locationType,
        locationRef: body.locationRef || null,
        parLevel: body.parLevel || 0,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
      },
    });

    return NextResponse.json({ store });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
