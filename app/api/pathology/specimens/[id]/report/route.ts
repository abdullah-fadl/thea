import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/pathology/specimens/[id]/report
 * Get the pathology report for a specimen.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }, params) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const report = await prisma.pathologyReport.findFirst({
      where: { specimenId: id, tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ report: report || null });
  }),
  { permissionKey: 'pathology.view' }
);

/**
 * POST /api/pathology/specimens/[id]/report
 * Create a draft pathology report for a specimen.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json();
    const {
      grossDescription,
      microscopicDescription,
      specialStains,
      immunohistochemistry,
      ihcMarkers,
      molecularResults,
      tumorCharacteristics,
      diagnosis,
      icdCode,
      snomed,
      comments,
    } = body;

    const specimen = await prisma.pathologySpecimen.findFirst({
      where: { id, tenantId },
    });
    if (!specimen) {
      return NextResponse.json({ error: 'Specimen not found' }, { status: 404 });
    }

    const existing = await prisma.pathologyReport.findFirst({
      where: { specimenId: id, tenantId },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'A report already exists. Use PUT to update it.' },
        { status: 409 }
      );
    }

    const report = await prisma.pathologyReport.create({
      data: {
        tenantId,
        specimenId: id,
        pathologistId: userId,
        grossDescription: grossDescription || null,
        microscopicDescription: microscopicDescription || null,
        specialStains: specialStains || null,
        immunohistochemistry: immunohistochemistry || null,
        ihcMarkers: Array.isArray(ihcMarkers) ? ihcMarkers : [],
        molecularResults: Array.isArray(molecularResults) ? molecularResults : [],
        tumorCharacteristics: tumorCharacteristics || null,
        diagnosis: diagnosis || '',
        icdCode: icdCode || null,
        snomed: snomed || null,
        comments: comments || null,
        status: 'DRAFT',
      },
    });

    // Advance specimen to REPORTING when report is first created
    if (specimen.status === 'STAINING' || specimen.status === 'SECTIONING') {
      await prisma.pathologySpecimen.update({
        where: { id },
        data: { status: 'REPORTING' },
      });
    }

    return NextResponse.json({ report }, { status: 201 });
  }),
  { permissionKey: 'pathology.report' }
);

/**
 * PUT /api/pathology/specimens/[id]/report
 * Update a draft report - save draft, sign/finalize, or amend.
 */
export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const id = String((params as Record<string, string>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json();
    const {
      grossDescription,
      microscopicDescription,
      specialStains,
      immunohistochemistry,
      ihcMarkers,
      molecularResults,
      tumorCharacteristics,
      diagnosis,
      icdCode,
      snomed,
      comments,
      status,
      amendmentNote,
    } = body;

    const report = await prisma.pathologyReport.findFirst({
      where: { specimenId: id, tenantId },
    });
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const updateData: any = { updatedAt: new Date() };
    if (grossDescription !== undefined) updateData.grossDescription = grossDescription;
    if (microscopicDescription !== undefined) updateData.microscopicDescription = microscopicDescription;
    if (specialStains !== undefined) updateData.specialStains = specialStains;
    if (immunohistochemistry !== undefined) updateData.immunohistochemistry = immunohistochemistry;
    if (ihcMarkers !== undefined) updateData.ihcMarkers = Array.isArray(ihcMarkers) ? ihcMarkers : [];
    if (molecularResults !== undefined) updateData.molecularResults = Array.isArray(molecularResults) ? molecularResults : [];
    if (tumorCharacteristics !== undefined) updateData.tumorCharacteristics = tumorCharacteristics;
    if (diagnosis !== undefined) updateData.diagnosis = diagnosis;
    if (icdCode !== undefined) updateData.icdCode = icdCode;
    if (snomed !== undefined) updateData.snomed = snomed;
    if (comments !== undefined) updateData.comments = comments;

    if (status === 'SIGNED') {
      if (!report.diagnosis && !diagnosis) {
        return NextResponse.json(
          { error: 'A diagnosis is required to finalize the report' },
          { status: 400 }
        );
      }
      updateData.status = 'SIGNED';
      updateData.signedAt = new Date();
      updateData.signedBy = userId;

      await prisma.pathologySpecimen.update({
        where: { id },
        data: { status: 'FINALIZED' },
      });
    } else if (status === 'PRELIMINARY') {
      updateData.status = 'PRELIMINARY';
    } else if (status === 'AMENDED') {
      if (report.status !== 'SIGNED') {
        return NextResponse.json(
          { error: 'Only signed reports can be amended' },
          { status: 400 }
        );
      }
      updateData.status = 'AMENDED';
      updateData.amendedAt = new Date();
      updateData.amendedBy = userId;
      if (amendmentNote) {
        updateData.amendmentNote = amendmentNote;
        // Append to amendments history
        const existing = Array.isArray(report.amendments) ? report.amendments : [];
        updateData.amendments = [
          ...existing,
          {
            date: new Date().toISOString(),
            reason: amendmentNote,
            previousDiagnosis: report.diagnosis,
          },
        ];
      }
    } else if (status === 'DRAFT') {
      updateData.status = 'DRAFT';
    }

    const updated = await prisma.pathologyReport.update({
      where: { id: report.id },
      data: updateData,
    });

    return NextResponse.json({ report: updated });
  }),
  { permissionKey: 'pathology.report' }
);
