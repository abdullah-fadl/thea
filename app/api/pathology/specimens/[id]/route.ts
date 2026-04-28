import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_STATUSES = [
  'RECEIVED',
  'GROSSING',
  'PROCESSING',
  'EMBEDDING',
  'SECTIONING',
  'STAINING',
  'REPORTING',
  'FINALIZED',
  'REJECTED',
] as const;

/**
 * GET /api/pathology/specimens/[id]
 * Get a single specimen with its associated pathology report.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }, params) => {
    const id = String((params as any)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const specimen = await prisma.pathologySpecimen.findFirst({
      where: { id, tenantId },
    });

    if (!specimen) {
      return NextResponse.json({ error: 'Specimen not found' }, { status: 404 });
    }

    const report = await prisma.pathologyReport.findFirst({
      where: { specimenId: id, tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ specimen, report: report || null });
  }),
  { permissionKey: 'pathology.view' }
);

/**
 * PUT /api/pathology/specimens/[id]
 * Update specimen status.
 */
export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const id = String((params as any)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json();
    const { status, notes } = body;

    const specimen = await prisma.pathologySpecimen.findFirst({
      where: { id, tenantId },
    });

    if (!specimen) {
      return NextResponse.json({ error: 'Specimen not found' }, { status: 404 });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { grossingData } = body;
    const updateData: any = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (grossingData !== undefined) updateData.grossingData = grossingData;
    if (status) updateData.lastUpdatedBy = userId;

    const updated = await prisma.pathologySpecimen.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ specimen: updated });
  }),
  { permissionKey: 'pathology.manage' }
);
