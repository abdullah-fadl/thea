/**
 * SCM BC9 Platform — Organizations
 *
 * GET  /api/imdad/platform/organizations — List organizations
 * POST /api/imdad/platform/organizations — Create organization
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List ImdadOrganization
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    const search = url.searchParams.get('search')?.trim() || '';
    const isActive = url.searchParams.get('isActive');
    const type = url.searchParams.get('type') || undefined;

    const where: any = { tenantId, isDeleted: false };

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.imdadOrganization.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.imdadOrganization.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.admin.view' }
);

// ---------------------------------------------------------------------------
// POST — Create ImdadOrganization
// ---------------------------------------------------------------------------
const createOrgSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  nameAr: z.string().optional(),
  type: z.enum(['HOSPITAL', 'CLINIC', 'WAREHOUSE', 'GROUP']),
  region: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().length(3).optional(),
  bedCount: z.number().int().optional(),
  isActive: z.boolean().optional(),
  goLiveDate: z.string().datetime().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createOrgSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    try {
      const organization = await prisma.imdadOrganization.create({
        data: {
          tenantId,
          code: data.code,
          name: data.name,
          nameAr: data.nameAr,
          type: data.type,
          region: data.region,
          city: data.city,
          address: data.address,
          timezone: data.timezone,
          currency: data.currency,
          bedCount: data.bedCount,
          isActive: data.isActive ?? true,
          goLiveDate: data.goLiveDate ? new Date(data.goLiveDate) : undefined,
          createdBy: userId,
          updatedBy: userId,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        actorUserId: userId,
        action: 'CREATE',
        resourceType: 'organization',
        resourceId: organization.id,
        boundedContext: 'BC9_PLATFORM',
        newData: organization as any,
        request: req,
      });

      return NextResponse.json({ organization }, { status: 201 });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return NextResponse.json(
          { error: 'Organization code already exists for this tenant' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.admin.org.create' }
);
