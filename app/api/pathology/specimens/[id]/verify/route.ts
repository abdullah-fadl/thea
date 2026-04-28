import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const verifySpecimenSchema = z.object({
  verifiedByUserId: z.string().min(1, 'verifiedByUserId is required'),
  findings: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/pathology/specimens/[id]/verify
 * Verify a pathology specimen — updates status to VERIFIED and records findings.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, params) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'Missing specimen id', errorAr: 'معرف العينة مطلوب' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, verifySpecimenSchema);
    if ('error' in v) return v.error;
    const { verifiedByUserId, findings, notes } = v.data;

    // Find the specimen
    const specimen = await prisma.pathologySpecimen.findFirst({
      where: { id, tenantId },
    });

    if (!specimen) {
      return NextResponse.json(
        { error: 'Specimen not found', errorAr: 'العينة غير موجودة' },
        { status: 404 }
      );
    }

    // Specimen must be in a state that allows verification (not already FINALIZED)
    if (specimen.status === 'FINALIZED') {
      return NextResponse.json(
        { error: 'Specimen already finalized', errorAr: 'تم اعتماد العينة مسبقا' },
        { status: 409 }
      );
    }

    const now = new Date();

    // Update specimen status
    const updated = await prisma.pathologySpecimen.update({
      where: { id },
      data: {
        status: 'REPORTING',
        updatedAt: now,
      },
    });

    // Update the associated pathology report with verification details
    const existingReport = await prisma.pathologyReport.findFirst({
      where: { specimenId: id, tenantId },
    });

    if (existingReport) {
      await prisma.pathologyReport.update({
        where: { id: existingReport.id },
        data: {
          status: 'FINAL',
          signedAt: now,
          signedBy: verifiedByUserId,
          diagnosis: findings || existingReport.diagnosis,
          comments: notes || existingReport.comments,
          updatedAt: now,
        },
      });
    } else {
      // Create a report if none exists yet
      await prisma.pathologyReport.create({
        data: {
          tenantId,
          specimenId: id,
          pathologistId: verifiedByUserId,
          diagnosis: findings || '',
          comments: notes || null,
          status: 'FINAL',
          signedAt: now,
          signedBy: verifiedByUserId,
        },
      });
    }

    // Create audit log
    await createAuditLog(
      'PathologySpecimen',
      id,
      'SPECIMEN_VERIFIED',
      userId,
      user?.email,
      {
        specimenId: id,
        previousStatus: specimen.status,
        newStatus: 'REPORTING',
        verifiedByUserId,
        findings: findings || null,
        verifiedAt: now.toISOString(),
      },
      tenantId,
      req
    );

    return NextResponse.json({
      success: true,
      message: 'Specimen verified successfully',
      messageAr: 'تم التحقق من العينة بنجاح',
      specimen: updated,
    });
  }),
  { permissionKey: 'pathology.manage' }
);
