/**
 * SCM BC6 Quality — Non-Conformance Reports (NCR)
 *
 * GET  /api/imdad/quality/ncr — List NCRs with pagination, search, filters
 * POST /api/imdad/quality/ncr — Create a new NCR
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List Non-Conformance Reports
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
      const search = url.searchParams.get('search')?.trim() || '';
      const organizationId = url.searchParams.get('organizationId') || undefined;
      const status = url.searchParams.get('status') || undefined;
      const severity = url.searchParams.get('severity') || undefined;
      const category = url.searchParams.get('category') || undefined;
      const itemId = url.searchParams.get('itemId') || undefined;
      const vendorId = url.searchParams.get('vendorId') || undefined;

      const where: any = { tenantId, isDeleted: false };

      if (organizationId) where.organizationId = organizationId;
      if (status) where.status = status;
      if (severity) where.severity = severity;
      if (category) where.category = category;
      if (itemId) where.itemId = itemId;
      if (vendorId) where.vendorId = vendorId;

      if (search) {
        where.OR = [
          { ncrNumber: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadNonConformanceReport.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadNonConformanceReport.count({ where }),
      ]);

      return NextResponse.json({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.view' }
);

// ---------------------------------------------------------------------------
// POST — Create Non-Conformance Report
// ---------------------------------------------------------------------------

const createNcrSchema = z.object({
  ncrNumber: z.string().min(1, 'ncrNumber is required'),
  title: z.string().min(1, 'title is required'),
  description: z.string().min(1, 'description is required'),
  category: z.string().min(1, 'category is required'),
  severity: z.string().min(1, 'severity is required'),
  reportedBy: z.string().min(1, 'reportedBy is required'),
  organizationId: z.string().min(1, 'organizationId is required'),
  itemId: z.string().optional(),
  vendorId: z.string().optional(),
  vendorName: z.string().optional(),
  lotNumber: z.string().optional(),
  quantityAffected: z.number().optional(),
  unitOfMeasure: z.string().optional(),
  reportedDate: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createNcrSchema.parse(body);

      // Check for duplicate NCR number within tenant + org
      const existing = await prisma.imdadNonConformanceReport.findFirst({
        where: {
          tenantId,
          organizationId: parsed.organizationId,
          ncrNumber: parsed.ncrNumber,
          isDeleted: false,
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'NCR with this number already exists' },
          { status: 409 }
        );
      }

      const ncr = await prisma.imdadNonConformanceReport.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          ncrNumber: parsed.ncrNumber,
          title: parsed.title,
          description: parsed.description,
          category: parsed.category,
          severity: parsed.severity,
          reportedBy: parsed.reportedBy,
          reportedAt: parsed.reportedDate ? new Date(parsed.reportedDate) : new Date(),
          status: 'OPEN',
          itemId: parsed.itemId,
          vendorId: parsed.vendorId,
          notes: parsed.notes,
          metadata: parsed.metadata ?? undefined,
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
        resourceType: 'NON_CONFORMANCE_REPORT',
        resourceId: ncr.id,
        boundedContext: 'BC6_QUALITY',
        newData: ncr as any,
        request: req,
      });

      return NextResponse.json({ data: ncr }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      console.error('[NCR] Creation error:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.ncr.create' }
);
