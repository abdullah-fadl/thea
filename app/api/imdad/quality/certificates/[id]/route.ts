/**
 * SCM BC6 Quality — Single Compliance Certificate
 *
 * GET   /api/imdad/quality/certificates/:id — Get certificate by id
 * PUT   /api/imdad/quality/certificates/:id — Update certificate (optimistic locking)
 * PATCH /api/imdad/quality/certificates/:id — Partial update (renewal, verification, deactivation)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single certificate
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const certificate = await prisma.imdadComplianceCertificate.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!certificate) {
        return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
      }

      return NextResponse.json({ data: certificate });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update certificate with optimistic locking
// ---------------------------------------------------------------------------

const updateCertificateSchema = z.object({
  version: z.number().int(),
  certificateType: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  entityName: z.string().optional(),
  issuingAuthority: z.string().optional(),
  issuedDate: z.string().optional(),
  expiryDate: z.string().optional(),
  scope: z.string().optional(),
  conditions: z.string().optional(),
  documentUrl: z.string().url().optional().or(z.literal('')),
  isActive: z.boolean().optional(),
  renewalStatus: z.string().optional(),
  notes: z.string().optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateCertificateSchema.parse(body);

      const { version, issuedDate, expiryDate, ...updates } = parsed;

      const existing = await prisma.imdadComplianceCertificate.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — certificate was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const updateData: any = {
        ...updates,
        version: { increment: 1 },
        updatedBy: userId,
      };

      if (issuedDate) updateData.issuedDate = new Date(issuedDate);
      if (expiryDate) updateData.expiryDate = new Date(expiryDate);

      const certificate = await prisma.imdadComplianceCertificate.update({
        where: { id },
        data: updateData,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'COMPLIANCE_CERTIFICATE',
        resourceId: id,
        boundedContext: 'BC6_QUALITY',
        previousData: existing as any,
        newData: certificate as any,
        request: req,
      });

      return NextResponse.json({ data: certificate });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.certificate.update' }
);

// ---------------------------------------------------------------------------
// PATCH — Partial update: renewal status, verification, deactivation
// ---------------------------------------------------------------------------

const patchCertificateSchema = z.object({
  version: z.number().int('version is required for optimistic locking'),
  renewalStatus: z.string().optional(),
  isVerified: z.boolean().optional(),
  verifiedBy: z.string().uuid().optional(),
  verifiedAt: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = patchCertificateSchema.parse(body);

      const { version, verifiedAt, ...updates } = parsed;

      const existing = await prisma.imdadComplianceCertificate.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — certificate was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const updateData: any = {
        ...updates,
        version: { increment: 1 },
        updatedBy: userId,
      };

      if (verifiedAt) updateData.verifiedAt = new Date(verifiedAt);

      const certificate = await prisma.imdadComplianceCertificate.update({
        where: { id },
        data: updateData,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'COMPLIANCE_CERTIFICATE',
        resourceId: id,
        boundedContext: 'BC6_QUALITY',
        previousData: existing as any,
        newData: certificate as any,
        request: req,
      });

      return NextResponse.json({ data: certificate });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.certificate.update' }
);
