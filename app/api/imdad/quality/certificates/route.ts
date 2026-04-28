/**
 * SCM BC6 Quality — Compliance Certificates
 *
 * GET  /api/imdad/quality/certificates — List certificates with pagination, search, filters
 * POST /api/imdad/quality/certificates — Create compliance certificate (unique on tenantId+orgId+certNumber)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List compliance certificates
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  certificateType: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  renewalStatus: z.string().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, organizationId, certificateType, entityType, entityId, isActive, renewalStatus } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (certificateType) where.certificateType = certificateType;
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;
      if (isActive !== undefined) where.isActive = isActive === 'true';
      if (renewalStatus) where.renewalStatus = renewalStatus;
      if (search) {
        where.OR = [
          { certificateNumber: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadComplianceCertificate.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadComplianceCertificate.count({ where }),
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
  { platformKey: 'imdad', permissionKey: 'imdad.quality.view' }
);

// ---------------------------------------------------------------------------
// POST — Create compliance certificate
// ---------------------------------------------------------------------------

const createCertificateSchema = z.object({
  organizationId: z.string().uuid(),
  certificateNumber: z.string().min(1).max(50),
  certificateType: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  issuingAuthority: z.string().min(1),
  issuedDate: z.string(),
  expiryDate: z.string(),
  entityName: z.string().optional(),
  scope: z.string().optional(),
  conditions: z.string().optional(),
  documentUrl: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createCertificateSchema.parse(body);

      // Check uniqueness on [tenantId, organizationId, certificateNumber]
      const duplicate = await prisma.imdadComplianceCertificate.findFirst({
        where: {
          tenantId,
          organizationId: parsed.organizationId,
          certificateNumber: parsed.certificateNumber,
          isDeleted: false,
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: `Certificate number ${parsed.certificateNumber} already exists for this organization` },
          { status: 409 }
        );
      }

      const certificate = await prisma.imdadComplianceCertificate.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          certificateNumber: parsed.certificateNumber,
          certificateType: parsed.certificateType as any,
          entityType: parsed.entityType,
          entityId: parsed.entityId,
          entityName: parsed.entityName,
          issuingAuthority: parsed.issuingAuthority,
          issuedDate: new Date(parsed.issuedDate),
          expiryDate: new Date(parsed.expiryDate),
          scope: parsed.scope,
          conditions: parsed.conditions,
          documentUrl: parsed.documentUrl || undefined,
          notes: parsed.notes,
          isActive: true,
          renewalStatus: 'CURRENT',
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
        resourceType: 'COMPLIANCE_CERTIFICATE',
        resourceId: certificate.id,
        boundedContext: 'BC6_QUALITY',
        newData: certificate as any,
        request: req,
      });

      return NextResponse.json({ data: certificate }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.certificate.create' }
);
