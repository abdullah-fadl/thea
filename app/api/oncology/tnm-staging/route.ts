import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler, BadRequestError } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';
import { calculateStageGroup } from '@/lib/oncology/tnmDefinitions';

// ---------------------------------------------------------------------------
// GET — List TNM stagings (filterable by patientMasterId, cancerType)
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const { searchParams } = new URL(req.url);
    const patientMasterId = searchParams.get('patientMasterId');
    const cancerType = searchParams.get('cancerType');

    const where: any = { tenantId };
    if (patientMasterId) where.patientMasterId = patientMasterId;
    if (cancerType) where.cancerType = cancerType;

    const stagings = await (prisma as any).tnmStaging.findMany({
      where,
      orderBy: { stagingDate: 'desc' },
      take: 100,
    });

    return NextResponse.json({ stagings });
  }),
  { permissionKey: 'oncology.view' },
);

// ---------------------------------------------------------------------------
// POST — Create a new TNM staging record
// ---------------------------------------------------------------------------

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    const body = await req.json();

    // Validate required fields
    const requiredFields = ['patientMasterId', 'cancerType', 'tCategory', 'nCategory', 'mCategory', 'stagingDate'];
    for (const field of requiredFields) {
      if (!body[field]) {
        throw new BadRequestError(`Missing required field: ${field}`);
      }
    }

    // Auto-calculate stage group
    const stageGroup = calculateStageGroup(
      body.cancerType,
      body.tCategory,
      body.nCategory,
      body.mCategory,
      body.biomarkers ?? undefined,
    );

    const staging = await (prisma as any).tnmStaging.create({
      data: {
        tenantId,
        patientMasterId: body.patientMasterId,
        cancerType: body.cancerType,
        stagingSystem: body.stagingSystem ?? 'AJCC_8TH',
        stagingType: body.stagingType ?? 'CLINICAL',
        tCategory: body.tCategory,
        nCategory: body.nCategory,
        mCategory: body.mCategory,
        stageGroup,
        gradeGroup: body.gradeGroup ?? null,
        biomarkers: body.biomarkers ?? null,
        stagingDate: new Date(body.stagingDate),
        stagedBy: body.stagedBy ?? userId,
        method: body.method ?? null,
        notes: body.notes ?? null,
      },
    });

    return NextResponse.json({ staging }, { status: 201 });
  }),
  { permissionKey: 'oncology.manage' },
);

// ---------------------------------------------------------------------------
// PUT — Update an existing TNM staging record
// ---------------------------------------------------------------------------

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const body = await req.json();

    if (!body.id) {
      throw new BadRequestError('Missing required field: id');
    }

    // Verify record belongs to tenant
    const existing = await (prisma as any).tnmStaging.findFirst({
      where: { id: body.id, tenantId },
    });

    if (!existing) {
      throw new BadRequestError('Staging record not found');
    }

    // Determine final T/N/M for re-calculation
    const tCategory = body.tCategory ?? existing.tCategory;
    const nCategory = body.nCategory ?? existing.nCategory;
    const mCategory = body.mCategory ?? existing.mCategory;
    const cancerType = body.cancerType ?? existing.cancerType;

    // Re-calculate stage group when T/N/M changed
    const tnmChanged =
      tCategory !== existing.tCategory ||
      nCategory !== existing.nCategory ||
      mCategory !== existing.mCategory ||
      cancerType !== existing.cancerType;

    const stageGroup = tnmChanged
      ? calculateStageGroup(cancerType, tCategory, nCategory, mCategory, body.biomarkers ?? existing.biomarkers ?? undefined)
      : existing.stageGroup;

    const updated = await (prisma as any).tnmStaging.update({
      where: { id: body.id },
      data: {
        ...(body.cancerType && { cancerType: body.cancerType }),
        ...(body.stagingSystem && { stagingSystem: body.stagingSystem }),
        ...(body.stagingType && { stagingType: body.stagingType }),
        ...(body.tCategory && { tCategory: body.tCategory }),
        ...(body.nCategory && { nCategory: body.nCategory }),
        ...(body.mCategory && { mCategory: body.mCategory }),
        stageGroup,
        ...(body.gradeGroup !== undefined && { gradeGroup: body.gradeGroup }),
        ...(body.biomarkers !== undefined && { biomarkers: body.biomarkers }),
        ...(body.stagingDate && { stagingDate: new Date(body.stagingDate) }),
        ...(body.method !== undefined && { method: body.method }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });

    return NextResponse.json({ staging: updated });
  }),
  { permissionKey: 'oncology.manage' },
);
