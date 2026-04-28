import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    const { searchParams } = new URL(req.url);
    const erVisitId = searchParams.get('erVisitId');
    const nationalId = searchParams.get('nationalId');
    const iqama = searchParams.get('iqama');

    if (!erVisitId && !nationalId && !iqama) {
      return NextResponse.json(
        { error: 'ER Visit ID, National ID, or Iqama is required' },
        { status: 400 }
      );
    }

    // Look up the patient from er_encounters or patient_master
    let patient: any = null;

    if (erVisitId) {
      const encounter = await prisma.erEncounter.findFirst({
        where: { id: erVisitId, tenantId },
        include: { patient: true },
      });
      patient = encounter?.patient || null;
    } else if (nationalId) {
      patient = await prisma.patientMaster.findFirst({
        where: { nationalId, tenantId },
      });
    } else if (iqama) {
      patient = await prisma.patientMaster.findFirst({
        where: { iqama, tenantId },
      });
    }

    if (!patient) {
      return NextResponse.json({
        alerts: [],
        message: 'No patient record found',
      });
    }

    // Build alert conditions based on available identifiers
    const orConditions: any[] = [];
    if (patient.nationalId) orConditions.push({ nationalId: patient.nationalId });
    if (patient.iqama) orConditions.push({ iqama: patient.iqama });

    // If no identifiers, return empty
    if (orConditions.length === 0) {
      return NextResponse.json({
        alerts: [],
        patientName: patient.fullName,
      });
    }

    // Patient alerts are stored in a generic table; use raw query for flexibility
    // since there's no dedicated Prisma model for patient_alerts
    const alerts: any[] = [];

    // Check allergy records as alerts
    const allergies = await prisma.patientAllergy.findMany({
      where: { patientId: patient.id, tenantId },
      take: 100,
    });

    for (const allergy of allergies) {
      alerts.push({
        id: allergy.id,
        type: 'allergy',
        title: `Allergy: ${(allergy as Record<string, unknown>).allergen || (allergy as Record<string, unknown>).substance || 'Unknown'}`,
        description: (allergy as Record<string, unknown>).reaction || (allergy as Record<string, unknown>).notes || '',
        severity: (allergy as Record<string, unknown>).severity || 'medium',
      });
    }

    return NextResponse.json({
      alerts,
      patientName: patient.fullName,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
