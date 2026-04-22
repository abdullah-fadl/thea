/**
 * SCM BC6 Quality — Vendor Audits
 *
 * GET  /api/imdad/quality/vendor-audits — List vendor audits with pagination, search, filters
 * POST /api/imdad/quality/vendor-audits — Create a new vendor audit
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List vendor audits
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
      const search = url.searchParams.get('search')?.trim() || '';
      const organizationId = url.searchParams.get('organizationId') || undefined;
      const vendorId = url.searchParams.get('vendorId') || undefined;
      const outcome = url.searchParams.get('outcome') || undefined;
      const auditType = url.searchParams.get('auditType') || undefined;

      const where: any = { tenantId, isDeleted: false };

      if (organizationId) where.organizationId = organizationId;
      if (vendorId) where.vendorId = vendorId;
      if (outcome) where.outcome = outcome;
      if (auditType) where.auditType = auditType;

      if (search) {
        where.OR = [
          { auditNumber: { contains: search, mode: 'insensitive' } },
          { vendorName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadVendorAudit.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadVendorAudit.count({ where }),
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
// POST — Create vendor audit
// ---------------------------------------------------------------------------

const createAuditSchema = z.object({
  auditNumber: z.string().min(1, 'auditNumber is required'),
  vendorId: z.string().min(1, 'vendorId is required'),
  vendorName: z.string().min(1, 'vendorName is required'),
  auditType: z.string().min(1, 'auditType is required'),
  plannedDate: z.string().min(1, 'plannedDate is required'),
  leadAuditorId: z.string().min(1, 'leadAuditorId is required'),
  organizationId: z.string().min(1, 'organizationId is required'),
  scope: z.string().optional(),
  criteria: z.string().optional(),
  auditorTeam: z.array(z.string()).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createAuditSchema.parse(body);

      // Check for duplicate audit number within tenant + org
      const existing = await prisma.imdadVendorAudit.findFirst({
        where: {
          tenantId,
          organizationId: parsed.organizationId,
          auditNumber: parsed.auditNumber,
          isDeleted: false,
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Vendor audit with this audit number already exists' },
          { status: 409 }
        );
      }

      const audit = await prisma.imdadVendorAudit.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          auditNumber: parsed.auditNumber,
          vendorId: parsed.vendorId,
          vendorName: parsed.vendorName,
          auditType: parsed.auditType,
          plannedDate: new Date(parsed.plannedDate),
          leadAuditorId: parsed.leadAuditorId,
          auditScope: parsed.scope,
          auditTeam: parsed.auditorTeam ?? [],
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
        resourceType: 'VENDOR_AUDIT',
        resourceId: audit.id,
        boundedContext: 'BC6_QUALITY',
        newData: audit as any,
        request: req,
      });

      return NextResponse.json({ data: audit }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.audit.create' }
);
