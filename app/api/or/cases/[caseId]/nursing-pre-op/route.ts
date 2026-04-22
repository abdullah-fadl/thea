import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/or/cases/[caseId]/nursing-pre-op
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params) => {
    try {
      const caseId = String((params as any)?.caseId || '').trim();
      if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });

      const record = await prisma.orNursingPreOp.findFirst({
        where: { tenantId, caseId },
      });

      return NextResponse.json({ nursingPreOp: record ?? null });
    } catch (e: unknown) {
      logger.error('[OR nursing-pre-op GET]', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch nursing pre-op' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);

// POST /api/or/cases/[caseId]/nursing-pre-op
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId, user }, params) => {
    try {
      const caseId = String((params as any)?.caseId || '').trim();
      if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });

      const orCase = await prisma.orCase.findFirst({ where: { tenantId, id: caseId } });
      if (!orCase) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

      const body = await req.json();
      const userName = user?.displayName || user?.email || null;

      const record = await prisma.orNursingPreOp.upsert({
        where: { caseId },
        create: {
          tenantId,
          caseId,
          assessedByUserId: userId,
          assessedByName: userName,
          assessedAt: new Date(),
          // Patient identification
          patientIdVerified: body.patientIdVerified ?? false,
          idBandChecked: body.idBandChecked ?? false,
          // NPO
          npoCompliant: body.npoCompliant ?? false,
          lastOralIntakeTime: body.lastOralIntakeTime ? new Date(body.lastOralIntakeTime) : null,
          npoNotes: body.npoNotes ?? null,
          // Allergies
          allergiesReviewed: body.allergiesReviewed ?? false,
          allergiesList: body.allergiesList ?? [],
          homeMediaReviewed: body.homeMediaReviewed ?? false,
          homeMedications: body.homeMedications ?? [],
          // Vitals
          vitals: body.vitals ?? null,
          // IV
          ivAccess: body.ivAccess ?? false,
          ivSite: body.ivSite ?? null,
          ivGauge: body.ivGauge ?? null,
          ivFluid: body.ivFluid ?? null,
          // Skin
          skinIntegrity: body.skinIntegrity ?? null,
          skinNotes: body.skinNotes ?? null,
          // Mental
          mentalStatus: body.mentalStatus ?? null,
          // Belongings
          jewelryRemoved: body.jewelryRemoved ?? false,
          denturesRemoved: body.denturesRemoved ?? false,
          prostheticsRemoved: body.prostheticsRemoved ?? false,
          hearingAidsRemoved: body.hearingAidsRemoved ?? false,
          belongingsSecured: body.belongingsSecured ?? false,
          belongingsNotes: body.belongingsNotes ?? null,
          // Consents
          surgicalConsentSigned: body.surgicalConsentSigned ?? false,
          anesthesiaConsentSigned: body.anesthesiaConsentSigned ?? false,
          bloodConsentSigned: body.bloodConsentSigned ?? false,
          // Lab
          labResultsReviewed: body.labResultsReviewed ?? false,
          imagingReviewed: body.imagingReviewed ?? false,
          bloodProductsReady: body.bloodProductsReady ?? false,
          pregnancyTestResult: body.pregnancyTestResult ?? null,
          // Surgical site
          surgicalSiteMarked: body.surgicalSiteMarked ?? false,
          siteMarkedBy: body.siteMarkedBy ?? null,
          laterality: body.laterality ?? null,
          // Safety
          fallRiskAssessed: body.fallRiskAssessed ?? false,
          fallRiskLevel: body.fallRiskLevel ?? null,
          dvtProphylaxis: body.dvtProphylaxis ?? false,
          dvtMethod: body.dvtMethod ?? null,
          patientEducation: body.patientEducation ?? false,
          // Status
          status: body.status ?? 'IN_PROGRESS',
          nursingNotes: body.nursingNotes ?? null,
        },
        update: {
          assessedByUserId: userId,
          assessedByName: userName,
          assessedAt: new Date(),
          patientIdVerified: body.patientIdVerified,
          idBandChecked: body.idBandChecked,
          npoCompliant: body.npoCompliant,
          lastOralIntakeTime: body.lastOralIntakeTime ? new Date(body.lastOralIntakeTime) : null,
          npoNotes: body.npoNotes ?? null,
          allergiesReviewed: body.allergiesReviewed,
          allergiesList: body.allergiesList ?? [],
          homeMediaReviewed: body.homeMediaReviewed,
          homeMedications: body.homeMedications ?? [],
          vitals: body.vitals ?? null,
          ivAccess: body.ivAccess,
          ivSite: body.ivSite ?? null,
          ivGauge: body.ivGauge ?? null,
          ivFluid: body.ivFluid ?? null,
          skinIntegrity: body.skinIntegrity ?? null,
          skinNotes: body.skinNotes ?? null,
          mentalStatus: body.mentalStatus ?? null,
          jewelryRemoved: body.jewelryRemoved,
          denturesRemoved: body.denturesRemoved,
          prostheticsRemoved: body.prostheticsRemoved,
          hearingAidsRemoved: body.hearingAidsRemoved,
          belongingsSecured: body.belongingsSecured,
          belongingsNotes: body.belongingsNotes ?? null,
          surgicalConsentSigned: body.surgicalConsentSigned,
          anesthesiaConsentSigned: body.anesthesiaConsentSigned,
          bloodConsentSigned: body.bloodConsentSigned,
          labResultsReviewed: body.labResultsReviewed,
          imagingReviewed: body.imagingReviewed,
          bloodProductsReady: body.bloodProductsReady,
          pregnancyTestResult: body.pregnancyTestResult ?? null,
          surgicalSiteMarked: body.surgicalSiteMarked,
          siteMarkedBy: body.siteMarkedBy ?? null,
          laterality: body.laterality ?? null,
          fallRiskAssessed: body.fallRiskAssessed,
          fallRiskLevel: body.fallRiskLevel ?? null,
          dvtProphylaxis: body.dvtProphylaxis,
          dvtMethod: body.dvtMethod ?? null,
          patientEducation: body.patientEducation,
          status: body.status ?? 'IN_PROGRESS',
          nursingNotes: body.nursingNotes ?? null,
        },
      });

      return NextResponse.json({ nursingPreOp: record }, { status: 201 });
    } catch (e: unknown) {
      logger.error('[OR nursing-pre-op POST]', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to save nursing pre-op' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);
