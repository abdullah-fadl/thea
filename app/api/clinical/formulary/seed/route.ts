import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { getBuiltInFormulary } from '@/lib/clinical/saudiFormulary';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST — Seed formulary with the built-in 80 drugs
export const POST = withAuthTenant(
  withErrorHandler(async (_req: NextRequest, { tenantId }) => {
    // Check if formulary is already seeded
    const existingCount = await prisma.formularyDrug.count({
      where: { tenantId },
    });

    if (existingCount > 0) {
      return NextResponse.json({
        success: false,
        message: 'Formulary already seeded',
        existingCount,
      }, { status: 400 });
    }

    const drugs = getBuiltInFormulary();

    // Batch insert all drugs
    let created = 0;
    for (const drug of drugs) {
      await prisma.formularyDrug.create({
        data: {
          tenantId,
          genericName: drug.genericName,
          genericNameAr: drug.genericNameAr,
          brandNames: drug.brandNames,
          sfdaRegistration: drug.sfda_registration || null,
          atcCode: drug.atcCode || null,
          atcCategory: drug.atcCategory || null,
          therapeuticClass: drug.therapeuticClass,
          therapeuticClassAr: drug.therapeuticClassAr,
          formularyStatus: drug.formularyStatus,
          restrictionCriteria: drug.restrictionCriteria || null,
          restrictionCriteriaAr: drug.restrictionCriteriaAr || null,
          approverRole: drug.approverRole || null,
          routes: drug.route,
          forms: drug.forms as unknown as string[],
          maxDailyDose: drug.maxDailyDose ?? null,
          maxDailyDoseUnit: drug.maxDailyDoseUnit || null,
          renalAdjustment: drug.renalAdjustment,
          hepaticAdjustment: drug.hepaticAdjustment,
          pregnancyCategory: drug.pregnancyCategory,
          lactationSafe: drug.lactationSafe,
          pediatricApproved: drug.pediatricApproved,
          geriatricCaution: drug.geriatricCaution,
          highAlert: drug.highAlertMedication,
          controlled: drug.controlledSubstance,
          controlSchedule: drug.controlSchedule || null,
          lasaPairs: drug.lookAlikeSoundAlike,
          blackBoxWarning: drug.blackBoxWarning || null,
          blackBoxWarningAr: drug.blackBoxWarningAr || null,
          interactions: drug.interactions as any,
          contraindications: drug.contraindications,
          contraindicationsAr: drug.contraindicationsAr,
          monitoringRequired: drug.monitoringRequired,
          storageConditions: drug.storageConditions || null,
        },
      });
      created++;
    }

    return NextResponse.json({
      success: true,
      created,
      message: `Seeded ${created} drugs into formulary`,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'formulary.manage' }
);
