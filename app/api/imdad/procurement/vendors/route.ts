/**
 * SCM BC3 Procurement — Vendor Management
 *
 * GET  /api/imdad/procurement/vendors — List vendors with pagination, search, filters
 * POST /api/imdad/procurement/vendors — Create a new vendor
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List vendors
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.string().optional(),
  tier: z.string().optional(),
  country: z.string().optional(),
  organizationId: z.string().uuid().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, status, tier, country, organizationId } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (status) where.status = status;
      if (tier) where.tier = tier;
      if (country) where.country = country;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadVendor.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadVendor.count({ where }),
      ]);

      return NextResponse.json({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.view' }
);

// ---------------------------------------------------------------------------
// POST — Create vendor
// ---------------------------------------------------------------------------

const createVendorSchema = z.object({
  organizationId: z.string().uuid(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  nameAr: z.string().optional(),
  country: z.string().min(2).max(3),
  type: z.string().min(1),
  paymentTerms: z.string().min(1),
  tier: z.string().optional(),
  taxId: z.string().optional(),
  currency: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  notes: z.string().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createVendorSchema.parse(body);

      const vendor = await prisma.imdadVendor.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          code: parsed.code,
          name: parsed.name,
          nameAr: parsed.nameAr,
          country: parsed.country,
          type: parsed.type,
          paymentTerms: parsed.paymentTerms,
          tier: parsed.tier as any,
          taxId: parsed.taxId,
          currency: parsed.currency || 'SAR',
          website: parsed.website || undefined,
          contactName: parsed.contactName,
          contactEmail: parsed.contactEmail || undefined,
          contactPhone: parsed.contactPhone,
          address: parsed.address,
          city: parsed.city,
          rating: parsed.rating,
          notes: parsed.notes,
          status: 'PENDING_APPROVAL' as any,
          createdBy: userId,
          updatedBy: userId,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'vendor',
        resourceId: vendor.id,
        boundedContext: 'BC3_PROCUREMENT',
        newData: vendor as any,
        request: req,
      });

      return NextResponse.json({ data: vendor }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.vendor.create' }
);
