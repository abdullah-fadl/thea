import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler, BadRequestError, NotFoundError } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getWorstGrade, type ToxicityEntry } from '@/lib/oncology/ctcaeDefinitions';

// ---------------------------------------------------------------------------
// GET — List CTCAE toxicity records
// ---------------------------------------------------------------------------
// Query params:
//   patientMasterId — filter by patient
//   cycleId         — filter by chemo cycle
//   minGrade        — only return records with overallWorstGrade >= minGrade
//   take            — number of records (default 100)

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const { searchParams } = new URL(req.url);
    const patientMasterId = searchParams.get('patientMasterId');
    const cycleId = searchParams.get('cycleId');
    const minGrade = searchParams.get('minGrade');
    const take = Math.min(Number(searchParams.get('take') || '100'), 500);

    const where: any = { tenantId };
    if (patientMasterId) where.patientMasterId = patientMasterId;
    if (cycleId) where.cycleId = cycleId;
    if (minGrade) {
      where.overallWorstGrade = { gte: Number(minGrade) };
    }

    const records = await prisma.ctcaeToxicityRecord.findMany({
      where,
      orderBy: { assessmentDate: 'desc' },
      take,
    });

    return NextResponse.json({ records });
  }),
  { permissionKey: 'oncology.view' },
);

// ---------------------------------------------------------------------------
// POST — Create a new CTCAE toxicity record
// ---------------------------------------------------------------------------
// Body:
//   patientMasterId  — required UUID
//   cycleId          — optional UUID
//   assessmentDate   — required ISO date string
//   toxicities       — required array of ToxicityEntry
//   doseModRequired  — optional boolean
//   treatmentHeld    — optional boolean
//   treatmentDiscontinued — optional boolean
//   nextAssessmentDate — optional ISO date string
//   notes            — optional string

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    const body = await req.json();

    if (!body.patientMasterId) {
      throw new BadRequestError('patientMasterId is required');
    }
    if (!body.assessmentDate) {
      throw new BadRequestError('assessmentDate is required');
    }
    if (!Array.isArray(body.toxicities) || body.toxicities.length === 0) {
      throw new BadRequestError('toxicities array is required and must not be empty');
    }

    // Validate each toxicity entry has required fields
    for (let i = 0; i < body.toxicities.length; i++) {
      const t = body.toxicities[i];
      if (!t.category || !t.term || !t.grade || !t.attribution) {
        throw new BadRequestError(
          `Toxicity entry at index ${i} is missing required fields (category, term, grade, attribution)`
        );
      }
      if (t.grade < 1 || t.grade > 5) {
        throw new BadRequestError(`Toxicity entry at index ${i} has invalid grade (must be 1-5)`);
      }
    }

    const toxicities: ToxicityEntry[] = body.toxicities;
    const overallWorstGrade = getWorstGrade(toxicities);

    const record = await prisma.ctcaeToxicityRecord.create({
      data: {
        tenantId,
        patientMasterId: body.patientMasterId,
        cycleId: body.cycleId || null,
        assessmentDate: new Date(body.assessmentDate),
        assessedBy: userId,
        ctcaeVersion: '5.0',
        toxicities: toxicities as unknown as Parameters<typeof prisma.ctcaeToxicityRecord.create>[0]['data']['toxicities'],
        overallWorstGrade,
        doseModRequired: body.doseModRequired ?? false,
        treatmentHeld: body.treatmentHeld ?? false,
        treatmentDiscontinued: body.treatmentDiscontinued ?? false,
        nextAssessmentDate: body.nextAssessmentDate ? new Date(body.nextAssessmentDate) : null,
        notes: body.notes || null,
      },
    });

    return NextResponse.json({ record }, { status: 201 });
  }),
  { permissionKey: 'oncology.manage' },
);

// ---------------------------------------------------------------------------
// PUT — Update an existing CTCAE toxicity record
// ---------------------------------------------------------------------------
// Body:
//   id               — required record UUID
//   toxicities       — optional updated array
//   doseModRequired  — optional boolean
//   treatmentHeld    — optional boolean
//   treatmentDiscontinued — optional boolean
//   nextAssessmentDate — optional ISO date string
//   notes            — optional string

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const body = await req.json();

    if (!body.id) {
      throw new BadRequestError('id is required');
    }

    // Verify record exists and belongs to this tenant
    const existing = await prisma.ctcaeToxicityRecord.findFirst({
      where: { id: body.id, tenantId },
    });
    if (!existing) {
      throw new NotFoundError('Toxicity record not found');
    }

    const updateData: any = {};

    // If toxicities are updated, recompute worst grade
    if (Array.isArray(body.toxicities)) {
      for (let i = 0; i < body.toxicities.length; i++) {
        const t = body.toxicities[i];
        if (!t.category || !t.term || !t.grade || !t.attribution) {
          throw new BadRequestError(
            `Toxicity entry at index ${i} is missing required fields (category, term, grade, attribution)`
          );
        }
        if (t.grade < 1 || t.grade > 5) {
          throw new BadRequestError(`Toxicity entry at index ${i} has invalid grade (must be 1-5)`);
        }
      }
      updateData.toxicities = body.toxicities;
      updateData.overallWorstGrade = getWorstGrade(body.toxicities as ToxicityEntry[]);
    }

    if (typeof body.doseModRequired === 'boolean') updateData.doseModRequired = body.doseModRequired;
    if (typeof body.treatmentHeld === 'boolean') updateData.treatmentHeld = body.treatmentHeld;
    if (typeof body.treatmentDiscontinued === 'boolean') updateData.treatmentDiscontinued = body.treatmentDiscontinued;
    if (body.nextAssessmentDate !== undefined) {
      updateData.nextAssessmentDate = body.nextAssessmentDate ? new Date(body.nextAssessmentDate) : null;
    }
    if (body.notes !== undefined) updateData.notes = body.notes || null;

    const record = await prisma.ctcaeToxicityRecord.update({
      where: { id: body.id },
      data: updateData,
    });

    return NextResponse.json({ record });
  }),
  { permissionKey: 'oncology.manage' },
);
