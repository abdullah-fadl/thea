/**
 * SCM BC7 Asset Management — Asset Disposals
 *
 * GET  /api/imdad/assets/disposals — List disposals with pagination, search, filters
 * POST /api/imdad/assets/disposals — Create a new disposal (also sets asset status to DISPOSED)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List disposals
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  disposalMethod: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, organizationId, disposalMethod, dateFrom, dateTo } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (disposalMethod) where.disposalMethod = disposalMethod;
      if (dateFrom || dateTo) {
        where.disposalDate = {};
        if (dateFrom) where.disposalDate.gte = new Date(dateFrom);
        if (dateTo) where.disposalDate.lte = new Date(dateTo);
      }
      if (search) {
        where.OR = [
          { disposalNumber: { contains: search, mode: 'insensitive' } },
          { assetTag: { contains: search, mode: 'insensitive' } },
          { assetName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadAssetDisposal.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadAssetDisposal.count({ where }),
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
  { platformKey: 'imdad', permissionKey: 'imdad.assets.disposals.list' }
);

// ---------------------------------------------------------------------------
// POST — Create disposal (also updates asset status to DISPOSED)
// ---------------------------------------------------------------------------

const createDisposalSchema = z.object({
  organizationId: z.string().uuid(),
  disposalNumber: z.string().min(1).max(50),
  assetId: z.string().uuid(),
  assetTag: z.string().min(1),
  assetName: z.string().min(1),
  disposalMethod: z.string().min(1),
  disposalDate: z.string().min(1),
  disposalReason: z.string().min(1),
  disposalReasonAr: z.string().optional(),
  processedBy: z.string().uuid(),
  approvedBy: z.string().uuid().optional(),
  approvedAt: z.string().optional(),
  bookValueAtDisposal: z.string().optional(),
  proceedsAmount: z.string().optional(),
  gainLoss: z.string().optional(),
  recipientName: z.string().optional(),
  recipientContact: z.string().optional(),
  disposalCertificate: z.string().optional(),
  hazmatDisposal: z.boolean().optional(),
  notes: z.string().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createDisposalSchema.parse(body);

      // Duplicate check: disposalNumber must be unique within tenant+org
      const existing = await prisma.imdadAssetDisposal.findFirst({
        where: { tenantId, organizationId: parsed.organizationId, disposalNumber: parsed.disposalNumber, isDeleted: false },
      });
      if (existing) {
        return NextResponse.json({ error: 'Disposal with this number already exists' }, { status: 409 });
      }

      const {
        disposalDate, approvedAt, bookValueAtDisposal,
        proceedsAmount, gainLoss, ...rest
      } = parsed;

      const disposal = await prisma.$transaction(async (tx) => {
        const created = await tx.imdadAssetDisposal.create({
          data: {
            tenantId,
            ...rest,
            disposalDate: new Date(disposalDate),
            approvedAt: approvedAt ? new Date(approvedAt) : undefined,
            bookValueAtDisposal: bookValueAtDisposal || undefined,
            proceedsAmount: proceedsAmount || undefined,
            gainLoss: gainLoss || undefined,
            createdBy: userId,
            updatedBy: userId,
          } as any,
        });

        // Update the asset status to DISPOSED
        await tx.imdadAsset.update({
          where: { id: parsed.assetId },
          data: {
            status: 'DISPOSED',
            version: { increment: 1 },
            updatedBy: userId,
          },
        });

        return created;
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'ASSET_DISPOSAL',
        resourceId: disposal.id,
        boundedContext: 'BC7_ASSETS',
        newData: disposal as any,
        metadata: { assetId: parsed.assetId, assetTag: parsed.assetTag },
        request: req,
      });

      return NextResponse.json({ data: disposal }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.assets.disposals.create' }
);
