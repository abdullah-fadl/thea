/**
 * SCM BC3 Procurement — Contracts
 *
 * GET  /api/imdad/procurement/contracts — List contracts with filters
 * POST /api/imdad/procurement/contracts — Create contract with lines
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List contracts
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.string().optional(),
  vendorId: z.string().uuid().optional(),
  contractType: z.string().optional(),
  organizationId: z.string().uuid().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, status, vendorId, contractType, organizationId } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (status) where.status = status;
      if (vendorId) where.vendorId = vendorId;
      if (contractType) where.contractType = contractType;

      const [data, total] = await Promise.all([
        prisma.imdadContract.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            vendor: { select: { id: true, name: true, code: true } },
          } as any,
        }),
        prisma.imdadContract.count({ where }),
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
// POST — Create contract
// ---------------------------------------------------------------------------

const contractLineSchema = z.object({
  itemId: z.string().uuid(),
  itemCode: z.string().optional(),
  itemName: z.string().min(1),
  quantity: z.number().positive(),
  unitOfMeasure: z.string().min(1),
  unitPrice: z.number().nonnegative(),
  notes: z.string().optional(),
});

const createContractSchema = z.object({
  organizationId: z.string().uuid(),
  vendorId: z.string().uuid(),
  contractType: z.string().min(1),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  currency: z.string().default('SAR'),
  paymentTerms: z.string().optional(),
  totalValue: z.number().nonnegative().optional(),
  autoRenew: z.boolean().default(false),
  renewalNoticeDays: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  lines: z.array(contractLineSchema).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createContractSchema.parse(body);

      // Generate contract number
      const counter = await prisma.imdadSequenceCounter.upsert({
        where: {
          tenantId_organizationId_sequenceType_fiscalYear: {
            tenantId,
            organizationId: parsed.organizationId,
            sequenceType: 'CONTRACT',
            fiscalYear: new Date().getFullYear(),
          },
        },
        create: {
          tenantId,
          organizationId: parsed.organizationId,
          sequenceType: 'CONTRACT',
          prefix: 'CON-',
          currentValue: 1,
          fiscalYear: new Date().getFullYear(),
        } as any,
        update: {
          currentValue: { increment: 1 },
        },
      });

      const contractNumber = `${counter.prefix}${new Date().getFullYear()}-${String(counter.currentValue).padStart(counter.padLength, '0')}`;

      const calculatedTotal = parsed.lines
        ? parsed.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
        : parsed.totalValue || 0;

      const contract = await prisma.imdadContract.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          contractNumber,
          status: 'DRAFT',
          vendorId: parsed.vendorId,
          type: parsed.contractType as any,
          title: parsed.title,
          description: parsed.description,
          startDate: new Date(parsed.startDate),
          endDate: new Date(parsed.endDate),
          value: calculatedTotal,
          currency: parsed.currency,
          paymentTerms: parsed.paymentTerms,
          autoRenew: parsed.autoRenew,
          notes: parsed.notes,
          createdBy: userId,
          updatedBy: userId,
          ...(parsed.lines && parsed.lines.length > 0
            ? {
                lines: {
                  create: parsed.lines.map((line, idx) => ({
                    tenantId,
                    organizationId: parsed.organizationId,
                    lineNumber: idx + 1,
                    itemId: line.itemId,
                    unitPrice: line.unitPrice,
                  })),
                },
              }
            : {}),
        } as any,
        include: { lines: true } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'contract',
        resourceId: contract.id,
        boundedContext: 'BC3_PROCUREMENT',
        newData: contract as any,
        request: req,
      });

      return NextResponse.json({ data: contract }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.contract.create' }
);
