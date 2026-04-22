import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const assessments = await prisma.psychiatricAssessment.findMany({
      where: { tenantId },
      orderBy: { assessmentDate: 'desc' },
      take: 100,
    });
    return NextResponse.json({ assessments });
  }),
  { permissionKey: 'psychiatry.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    const body = await req.json();
    const assessment = await prisma.psychiatricAssessment.create({
      data: {
        tenantId,
        patientMasterId: body.patientMasterId,
        episodeId: body.episodeId || null,
        encounterId: body.encounterId || null,
        assessedBy: body.assessedBy || userId,
        assessmentDate: new Date(body.assessmentDate || Date.now()),
        chiefComplaint: body.chiefComplaint,
        presentingIllness: body.presentingIllness ?? null,
        psychiatricHistory: body.psychiatricHistory ?? null,
        medicalHistory: body.medicalHistory ?? null,
        familyHistory: body.familyHistory ?? null,
        substanceUse: body.substanceUse ?? null,
        mentalStatusExam: body.mentalStatusExam ?? {},
        riskAssessment: body.riskAssessment ?? null,
        diagnosis: body.diagnosis ?? null,
        icdCode: body.icdCode ?? null,
        dsm5Diagnosis: body.dsm5Diagnosis ?? null,
        formulation: body.formulation ?? null,
        treatmentPlan: body.treatmentPlan ?? null,
        disposition: body.disposition ?? null,
        followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
      },
    });
    return NextResponse.json({ assessment }, { status: 201 });
  }),
  { permissionKey: 'psychiatry.manage' },
);
