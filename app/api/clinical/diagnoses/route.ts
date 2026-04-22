import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface DiagnosisEntry {
  code: string;
  description: string;
  descriptionAr?: string;
  diagnosisType: 'PRIMARY' | 'SECONDARY';
  notes?: string;
  onset?: 'ACUTE' | 'CHRONIC' | 'UNKNOWN';
  severity?: 'MILD' | 'MODERATE' | 'SEVERE';
  confirmed?: boolean;
}

/**
 * GET /api/clinical/diagnoses?encounterId=xxx
 * Fetch diagnoses for an encounter from the visit note
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const encounterId = req.nextUrl.searchParams.get('encounterId');
    if (!encounterId) {
      return NextResponse.json({ error: 'encounterId required' }, { status: 400 });
    }

    // Find the latest visit note for this encounter
    const note = await prisma.opdVisitNote.findFirst({
      where: { tenantId, encounterCoreId: encounterId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, diagnoses: true, updatedAt: true },
    });

    const items = Array.isArray(note?.diagnoses) ? note.diagnoses : [];

    return NextResponse.json({ items, noteId: note?.id || null });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKeys: ['opd.visit.view', 'opd.doctor.encounter.view', 'opd.doctor.visit.view'] }
);

/**
 * POST /api/clinical/diagnoses
 * Save diagnoses for an encounter (upserts into OpdVisitNote.diagnoses JSON)
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();
    const { encounterId, patientId, diagnoses } = body;

    if (!encounterId) {
      return NextResponse.json({ error: 'encounterId is required' }, { status: 400 });
    }

    if (!Array.isArray(diagnoses) || diagnoses.length === 0) {
      return NextResponse.json({ error: 'At least one diagnosis is required' }, { status: 400 });
    }

    // Validate PRIMARY exists
    const hasPrimary = diagnoses.some((d: DiagnosisEntry) => d.diagnosisType === 'PRIMARY');
    if (!hasPrimary) {
      return NextResponse.json({
        error: 'PRIMARY_REQUIRED',
        message: 'يجب اختيار تشخيص رئيسي واحد على الأقل',
        messageEn: 'At least one primary diagnosis is required',
      }, { status: 400 });
    }

    // Validate each diagnosis entry
    for (const d of diagnoses) {
      if (!d.code || !d.description) {
        return NextResponse.json({
          error: 'Each diagnosis must have a code and description',
        }, { status: 400 });
      }
      if (!['PRIMARY', 'SECONDARY'].includes(d.diagnosisType)) {
        return NextResponse.json({
          error: 'diagnosisType must be PRIMARY or SECONDARY',
        }, { status: 400 });
      }
    }

    // Build the diagnoses JSON payload
    const now = new Date().toISOString();
    const diagnosesPayload = diagnoses.map((d: DiagnosisEntry, index: number) => ({
      code: d.code,
      description: d.description,
      descriptionAr: d.descriptionAr || '',
      diagnosisType: d.diagnosisType,
      isPrimary: d.diagnosisType === 'PRIMARY',
      notes: d.notes || '',
      onset: d.onset || 'UNKNOWN',
      severity: d.severity || null,
      confirmed: d.confirmed !== false,
      diagnosedBy: userId,
      diagnosedAt: now,
      order: index,
    }));

    // Resolve patientId from encounter if not provided
    let resolvedPatientId = patientId;
    if (!resolvedPatientId) {
      const encounter = await prisma.encounterCore.findFirst({
        where: { tenantId, id: encounterId },
        select: { patientId: true },
      });
      resolvedPatientId = encounter?.patientId || null;
    }

    // Find existing visit note for this encounter or create one
    const existingNote = await prisma.opdVisitNote.findFirst({
      where: { tenantId, encounterCoreId: encounterId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (existingNote) {
      await prisma.opdVisitNote.update({
        where: { id: existingNote.id },
        data: {
          diagnoses: diagnosesPayload,
          updatedByUserId: userId,
        },
      });
    } else {
      await prisma.opdVisitNote.create({
        data: {
          tenantId,
          encounterCoreId: encounterId,
          patientId: resolvedPatientId,
          diagnoses: diagnosesPayload,
          createdByUserId: userId,
          updatedByUserId: userId,
        },
      });
    }

    return NextResponse.json({ success: true, diagnoses: diagnosesPayload });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKeys: ['opd.doctor.encounter.view', 'opd.doctor.visit.view', 'opd.visit.edit'] }
);
