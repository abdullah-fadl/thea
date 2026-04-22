import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { verifyCredential } from '@/lib/credentialing/engine';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/credentialing/credentials/[id]
 * Get credential detail
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolved = params instanceof Promise ? await params : params;
    const id = resolved?.id as string;
    if (!id) {
      return NextResponse.json({ error: 'Missing credential ID' }, { status: 400 });
    }

    const credential = await prisma.staffCredential.findFirst({
      where: { id, tenantId },
    });

    if (!credential) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    return NextResponse.json({ credential });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'credentialing.view' },
);

/**
 * PATCH /api/credentialing/credentials/[id]
 * Update credential or verify it
 */
const updateSchema = z.object({
  action: z.enum(['update', 'verify', 'reject']).optional(),
  credentialNumber: z.string().optional(),
  issuingAuthority: z.string().optional(),
  issuingAuthorityAr: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  status: z.string().optional(),
  verificationStatus: z.string().optional(),
  documentUrl: z.string().optional(),
  category: z.string().optional(),
  specialtyCode: z.string().optional(),
  notes: z.string().optional(),
  staffName: z.string().optional(),
  staffNameAr: z.string().optional(),
}).passthrough();

export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId: actorId, user }, params) => {
    const resolved = params instanceof Promise ? await params : params;
    const id = resolved?.id as string;
    if (!id) {
      return NextResponse.json({ error: 'Missing credential ID' }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const result = validateBody(body, updateSchema);
    if ('error' in result) return result.error;
    const data = result.data;

    // Verify action
    if (data.action === 'verify') {
      const verifyResult = await verifyCredential(id, actorId, tenantId, user?.email);
      if ('error' in verifyResult) {
        return NextResponse.json({ error: verifyResult.error }, { status: 404 });
      }
      return NextResponse.json({ success: true, credential: verifyResult.credential });
    }

    // Reject verification
    if (data.action === 'reject') {
      const existing = await prisma.staffCredential.findFirst({ where: { id, tenantId } });
      if (!existing) {
        return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
      }

      const updated = await prisma.staffCredential.update({
        where: { id },
        data: {
          verificationStatus: 'failed',
          notes: data.notes || existing.notes,
        },
      });

      await createAuditLog(
        'staff_credential',
        id,
        'REJECT_VERIFICATION',
        actorId,
        user?.email,
        { before: { verificationStatus: existing.verificationStatus }, after: { verificationStatus: 'failed' } },
        tenantId,
      );

      return NextResponse.json({ success: true, credential: updated });
    }

    // Regular update
    const existing = await prisma.staffCredential.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    const updateData: Record<string, any> = {};
    if (data.credentialNumber !== undefined) updateData.credentialNumber = data.credentialNumber;
    if (data.issuingAuthority !== undefined) updateData.issuingAuthority = data.issuingAuthority;
    if (data.issuingAuthorityAr !== undefined) updateData.issuingAuthorityAr = data.issuingAuthorityAr;
    if (data.issueDate !== undefined) updateData.issueDate = new Date(data.issueDate);
    if (data.expiryDate !== undefined) updateData.expiryDate = new Date(data.expiryDate);
    if (data.status !== undefined) updateData.status = data.status;
    if (data.verificationStatus !== undefined) updateData.verificationStatus = data.verificationStatus;
    if (data.documentUrl !== undefined) updateData.documentUrl = data.documentUrl;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.specialtyCode !== undefined) updateData.specialtyCode = data.specialtyCode;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.staffName !== undefined) updateData.staffName = data.staffName;
    if (data.staffNameAr !== undefined) updateData.staffNameAr = data.staffNameAr;

    const updated = await prisma.staffCredential.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog(
      'staff_credential',
      id,
      'UPDATE',
      actorId,
      user?.email,
      { before: existing, after: updated },
      tenantId,
    );

    return NextResponse.json({ success: true, credential: updated });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'credentialing.manage' },
);
