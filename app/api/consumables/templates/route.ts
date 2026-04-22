import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { CONSUMABLE_USAGE_TEMPLATES } from '@/lib/consumables/seedCatalog';

// Cast for new consumable models not yet in generated Prisma client
const db = prisma as Record<string, any>;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const department = req.nextUrl.searchParams.get('department') || '';
    const seed = req.nextUrl.searchParams.get('seed') === 'true';

    // Seed templates on first request
    if (seed) {
      const count = await db.consumableUsageTemplate.count({ where: { tenantId } });
      if (count === 0) {
        const now = new Date();
        for (const tmpl of CONSUMABLE_USAGE_TEMPLATES) {
          // Resolve supply catalog IDs from names
          const resolvedItems = [];
          for (const item of tmpl.items) {
            const supply = await prisma.suppliesCatalog.findFirst({
              where: { tenantId, name: { contains: item.supplyName, mode: 'insensitive' } },
              select: { id: true, code: true, name: true },
            });
            resolvedItems.push({
              supplyCatalogId: supply?.id || '',
              supplyCode: supply?.code || '',
              supplyName: supply?.name || item.supplyName,
              defaultQty: item.defaultQty,
            });
          }
          await db.consumableUsageTemplate.create({
            data: {
              id: uuidv4(),
              tenantId,
              name: tmpl.name,
              nameAr: tmpl.nameAr || null,
              department: tmpl.department,
              usageContext: tmpl.usageContext,
              items: resolvedItems,
              isActive: true,
              sortOrder: 0,
              createdAt: now,
              updatedAt: now,
            },
          });
        }
      }
    }

    const where: any = { tenantId, isActive: true };
    if (department && department !== 'ALL') {
      where.OR = [{ department }, { department: 'ALL' }];
    }

    const templates = await db.consumableUsageTemplate.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: 200,
    });

    return NextResponse.json({ templates });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);

const createTemplateSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  department: z.string().min(1),
  usageContext: z.string().min(1),
  items: z.array(z.object({
    supplyCatalogId: z.string().min(1),
    supplyCode: z.string(),
    supplyName: z.string(),
    defaultQty: z.number().int().min(1),
  })).min(1),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();
    const v = validateBody(body, createTemplateSchema);
    if ('error' in v) return v.error;

    const now = new Date();
    const template = await db.consumableUsageTemplate.create({
      data: {
        id: uuidv4(),
        tenantId,
        name: body.name,
        nameAr: body.nameAr || null,
        department: body.department,
        usageContext: body.usageContext,
        items: body.items,
        isActive: true,
        sortOrder: body.sortOrder || 0,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
      },
    });

    return NextResponse.json({ template });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
