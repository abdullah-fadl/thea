import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/pathology/specimens
 * List pathology specimens with optional filters.
 */
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = req.nextUrl;
      const status = url.searchParams.get('status');
      const patientMasterId = url.searchParams.get('patientMasterId');
      const search = url.searchParams.get('search') || '';

      const where: Record<string, unknown> = { tenantId };
      if (status) where.status = status;
      if (patientMasterId) where.patientMasterId = patientMasterId;
      if (search) {
        (where as Record<string, unknown>).OR = [
          { accessionNumber: { contains: search, mode: 'insensitive' } },
          { specimenType: { contains: search, mode: 'insensitive' } },
          { site: { contains: search, mode: 'insensitive' } },
        ];
      }

      const specimens = await prisma.pathologySpecimen.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      return NextResponse.json({ specimens });
    } catch {
      return NextResponse.json({ error: 'Failed to fetch specimens' }, { status: 500 });
    }
  },
  { permissionKey: 'pathology.view' }
);

/**
 * POST /api/pathology/specimens
 * Receive / register a new pathology specimen.
 */
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const body = await req.json();
      const {
        patientMasterId,
        specimenType,
        site,
        clinicalHistory,
        clinicalDiagnosis,
        collectedBy,
        collectedAt,
        fixative,
        numberOfParts,
        episodeId,
        caseId,
        accessionNumber,
      } = body;

      if (!patientMasterId || !specimenType || !site) {
        return NextResponse.json(
          { error: 'patientMasterId, specimenType, and site are required' },
          { status: 400 }
        );
      }

      // Generate accession number if not provided
      const finalAccession =
        accessionNumber ||
        `PATH-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

      // Ensure accession number is unique
      const existing = await prisma.pathologySpecimen.findFirst({
        where: { accessionNumber: finalAccession, tenantId },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Accession number already exists' },
          { status: 409 }
        );
      }

      const specimen = await prisma.pathologySpecimen.create({
        data: {
          tenantId,
          patientMasterId,
          specimenType,
          site,
          clinicalHistory: clinicalHistory || null,
          clinicalDiagnosis: clinicalDiagnosis || null,
          collectedBy: collectedBy || null,
          collectedAt: collectedAt ? new Date(collectedAt) : null,
          receivedAt: new Date(),
          fixative: fixative || null,
          numberOfParts: numberOfParts || 1,
          status: 'RECEIVED',
          accessionNumber: finalAccession,
          receivedBy: userId,
          episodeId: episodeId || null,
          caseId: caseId || null,
        },
      });

      return NextResponse.json({ specimen }, { status: 201 });
    } catch {
      return NextResponse.json({ error: 'Failed to register specimen' }, { status: 500 });
    }
  },
  { permissionKey: 'pathology.receive' }
);
