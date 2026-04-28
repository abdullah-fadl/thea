import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';
import { mergePatientSchema } from '@/lib/validation/patient.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, mergePatientSchema);
  if ('error' in v) return v.error;

  const sourcePatientId = String(body.sourcePatientId || '').trim();
  const targetPatientId = String(body.targetPatientId || '').trim();
  const reason = String(body.reason || '').trim();
  if (!sourcePatientId || !targetPatientId) {
    return NextResponse.json({ error: 'sourcePatientId and targetPatientId are required' }, { status: 400 });
  }
  if (sourcePatientId === targetPatientId) {
    return NextResponse.json({ error: 'sourcePatientId and targetPatientId must be different' }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 });
  }

  const source = await prisma.patientMaster.findFirst({ where: { tenantId, id: sourcePatientId } });
  const target = await prisma.patientMaster.findFirst({ where: { tenantId, id: targetPatientId } });

  if (!source) {
    return NextResponse.json({ error: 'Source patient not found' }, { status: 404 });
  }
  if (!target) {
    return NextResponse.json({ error: 'Target patient not found' }, { status: 404 });
  }
  if (String(source.status || '') === 'MERGED') {
    return NextResponse.json({ error: 'Source patient already merged' }, { status: 409 });
  }
  if (String(target.status || '') === 'MERGED') {
    return NextResponse.json({ error: 'Target patient cannot be merged' }, { status: 409 });
  }
  if (target.mergedIntoPatientId === sourcePatientId) {
    return NextResponse.json({ error: 'Merge loop detected' }, { status: 409 });
  }

  // [M-01] Cascade validation: check for pending obligations before merge
  const pendingOrders = await prisma.ordersHub.count({
    where: { tenantId, patientMasterId: sourcePatientId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
  });
  if (pendingOrders > 0 && !body.acknowledgePendingOrders) {
    return NextResponse.json(
      { error: `Source patient has ${pendingOrders} pending order(s). Resolve before merge.`, code: 'PENDING_ORDERS', pendingOrders },
      { status: 422 }
    );
  }

  const pendingBilling = await prisma.billingChargeEvent.count({
    where: { tenantId, patientMasterId: sourcePatientId, status: 'ACTIVE', payerType: 'PENDING' },
  });
  if (pendingBilling > 0 && !body.acknowledgePendingBilling) {
    return NextResponse.json(
      { error: `Source patient has ${pendingBilling} unresolved billing charge(s). Resolve before merge.`, code: 'PENDING_BILLING', pendingBilling },
      { status: 422 }
    );
  }

  // IPD episodes link via encounterCore → check encounters for active episodes
  const sourceEncounterIds = (await prisma.encounterCore.findMany({
    where: { tenantId, patientId: sourcePatientId },
    select: { id: true },
  })).map(e => e.id);
  const activeEpisodes = sourceEncounterIds.length > 0
    ? await prisma.ipdEpisode.count({
        where: { tenantId, encounterId: { in: sourceEncounterIds }, status: { notIn: ['DISCHARGED', 'CANCELLED'] } },
      })
    : 0;
  if (activeEpisodes > 0) {
    return NextResponse.json(
      { error: 'Source patient has active IPD episodes. Discharge before merge.', code: 'ACTIVE_IPD_EPISODE' },
      { status: 409 }
    );
  }

  const now = new Date();

  // ---------------------------------------------------------------------------
  // Handle unique-constrained tables: delete source record if target already owns one
  // ---------------------------------------------------------------------------

  // DentalChart: @@unique([tenantId, patientId])
  const targetDentalChart = await prisma.dentalChart.findUnique({
    where: { tenantId_patientId: { tenantId, patientId: targetPatientId } },
  });
  if (targetDentalChart) {
    await prisma.dentalChart.deleteMany({ where: { tenantId, patientId: sourcePatientId } });
  }

  // PatientClinicalHistory: @@unique([tenantId, patientId])
  const targetClinicalHistory = await prisma.patientClinicalHistory.findUnique({
    where: { tenantId_patientId: { tenantId, patientId: targetPatientId } },
  });
  if (targetClinicalHistory) {
    await prisma.patientClinicalHistory.deleteMany({ where: { tenantId, patientId: sourcePatientId } });
  }

  // CareGapFinding: @@unique([tenantId, patientId, ruleId, gapType]) — partial overlap possible
  // DailyCarePath: @@unique([tenantId, patientMasterId, date, departmentType]) — partial overlap possible
  // For these, we handle conflicts inside the transaction using raw SQL to skip duplicates.

  // ---------------------------------------------------------------------------
  // Full cascade: update ALL patient-referencing tables atomically
  // ---------------------------------------------------------------------------
  const cascadeResults = await prisma.$transaction(async (tx) => {
    const counts: Record<string, number> = {};

    // Helper for updateMany on patientId
    const cascadePatientId = async (model: string, delegate: any) => {
      const result = await delegate.updateMany({
        where: { tenantId, patientId: sourcePatientId },
        data: { patientId: targetPatientId },
      });
      counts[model] = result.count;
    };

    // Helper for updateMany on patientMasterId
    const cascadePatientMasterId = async (model: string, delegate: any) => {
      const result = await delegate.updateMany({
        where: { tenantId, patientMasterId: sourcePatientId },
        data: { patientMasterId: targetPatientId },
      });
      counts[model] = result.count;
    };

    // Helper for models with both patientId AND patientMasterId
    const cascadeBoth = async (model: string, delegate: any) => {
      const result = await delegate.updateMany({
        where: { tenantId, OR: [{ patientId: sourcePatientId }, { patientMasterId: sourcePatientId }] },
        data: { patientId: targetPatientId, patientMasterId: targetPatientId },
      });
      counts[model] = result.count;
    };

    // === 1. PatientMaster status update ===
    await tx.patientMaster.update({
      where: { id: sourcePatientId },
      data: {
        status: 'MERGED',
        mergedIntoPatientId: targetPatientId,
        mergedAt: now,
        updatedAt: now,
        updatedByUserId: userId,
      },
    });
    await tx.patientMaster.update({
      where: { id: targetPatientId },
      data: { updatedAt: now, updatedByUserId: userId },
    });

    // === 2. Encounter / Core ===
    await cascadePatientId('encounterCore', tx.encounterCore);

    // === 3. OPD ===
    await cascadePatientId('opdEncounter', tx.opdEncounter);
    await cascadeBoth('opdBooking', tx.opdBooking);
    await cascadePatientId('opdOrder', tx.opdOrder);
    await cascadePatientId('opdVisitNote', tx.opdVisitNote);
    await cascadePatientId('opdRecommendation', tx.opdRecommendation);

    // === 4. ER ===
    await cascadePatientMasterId('erPatient', tx.erPatient);
    await cascadePatientId('erEncounter', tx.erEncounter);
    await cascadePatientId('respiratoryScreening', tx.respiratoryScreening);
    await cascadePatientId('mciPatient', tx.mciPatient);

    // === 5. IPD ===
    // IpdAdmission has both patientMasterId (UUID) and patientId (plain String, legacy/MRN)
    // Only cascade patientMasterId; patientId may store MRN or other non-UUID values
    await cascadePatientMasterId('ipdAdmission', tx.ipdAdmission);
    await cascadePatientMasterId('icuCodeBlue', tx.icuCodeBlue);
    await cascadePatientId('brainDeathProtocol', tx.brainDeathProtocol);
    await cascadePatientId('organDonation', tx.organDonation);

    // === 6. Orders ===
    await cascadePatientMasterId('ordersHub', tx.ordersHub);
    await cascadePatientId('labResult', tx.labResult);
    await cascadePatientId('radiologyReport', tx.radiologyReport);
    await cascadePatientId('connectResult', tx.connectResult);
    // connectDeviceVitals: patientMasterId is inside JSON (patientLink), not a direct field — skip

    // === 7. Lab ===
    await cascadePatientId('labOrder', tx.labOrder);
    await cascadePatientId('labSpecimen', tx.labSpecimen);
    await cascadePatientId('labCriticalAlert', tx.labCriticalAlert);
    await cascadePatientId('labMicroCulture', tx.labMicroCulture);

    // === 8. Pharmacy ===
    await cascadePatientId('pharmacyPrescription', tx.pharmacyPrescription);
    await cascadePatientId('pharmacyUnitDose', tx.pharmacyUnitDose);
    await cascadePatientId('pharmacyControlledSubstanceLog', tx.pharmacyControlledSubstanceLog);

    // === 9. Billing ===
    await cascadePatientMasterId('billingChargeEvent', tx.billingChargeEvent);
    await cascadePatientMasterId('billingInvoice', tx.billingInvoice);
    await cascadePatientMasterId('billingCreditNote', tx.billingCreditNote);
    await cascadePatientId('nphiesEligibilityLog', tx.nphiesEligibilityLog);
    await cascadePatientId('nphiesClaim', tx.nphiesClaim);
    await cascadePatientId('nphiesPriorAuth', tx.nphiesPriorAuth);

    // === 10. Patient domain ===
    await cascadePatientId('patientAllergy', tx.patientAllergy);
    await cascadePatientId('patientProblem', tx.patientProblem);
    await cascadePatientId('patientInsurance', tx.patientInsurance);
    await cascadePatientId('patientIdentityLink', tx.patientIdentityLink);
    await cascadePatientId('portalProxyAccess', tx.portalProxyAccess);

    // === 11. Clinical ===
    await cascadePatientId('physicalExam', tx.physicalExam);
    await cascadePatientId('homeMedication', tx.homeMedication);
    await cascadePatientId('deathDeclaration', tx.deathDeclaration);
    await cascadePatientMasterId('clinicalNote', tx.clinicalNote);
    await cascadePatientId('clinicalConsent', tx.clinicalConsent);
    await cascadePatientMasterId('consultRequest', tx.consultRequest);
    await cascadePatientMasterId('woundAssessment', tx.woundAssessment);
    await cascadePatientMasterId('nutritionalAssessment', tx.nutritionalAssessment);
    await cascadePatientMasterId('socialWorkAssessment', tx.socialWorkAssessment);
    await cascadePatientMasterId('patientEducationRecord', tx.patientEducationRecord);
    await cascadePatientMasterId('infectionSurveillance', tx.infectionSurveillance);
    await cascadePatientMasterId('partogram', tx.partogram);
    await cascadePatientId('dietaryOrder', tx.dietaryOrder);
    await cascadePatientId('mealService', tx.mealService);
    await cascadePatientMasterId('tpnOrder', tx.tpnOrder);
    await cascadePatientMasterId('calorieIntakeRecord', tx.calorieIntakeRecord);
    await cascadePatientId('transportRequest', tx.transportRequest);
    await cascadePatientId('formularyRestrictionRequest', tx.formularyRestrictionRequest);
    await cascadePatientId('bloodGasAnalysis', tx.bloodGasAnalysis);
    await cascadePatientId('radiologyPriorStudy', tx.radiologyPriorStudy);
    await cascadePatientId('kitchenTrayCard', tx.kitchenTrayCard);
    await cascadePatientId('ivAdmixtureOrder', tx.ivAdmixtureOrder);
    await cascadePatientId('adcTransaction', tx.adcTransaction);
    await cascadePatientId('ctgRecording', tx.ctgRecording);

    // === 12. Admission ===
    await cascadePatientMasterId('admissionRequest', tx.admissionRequest);
    await cascadePatientMasterId('wardTransferRequest', tx.wardTransferRequest);

    // === 13. Discharge ===
    await cascadePatientMasterId('enhancedDischargeSummary', tx.enhancedDischargeSummary);

    // === 14. AI ===
    await cascadePatientId('cdsAlert', tx.cdsAlert);

    // === 15. Analytics / Infection control ===
    await cascadePatientId('infectionEvent', tx.infectionEvent);
    await cascadePatientId('antibioticUsage', tx.antibioticUsage);
    await cascadePatientId('stewardshipAlert', tx.stewardshipAlert);
    await cascadePatientId('medicationError', tx.medicationError);
    await cascadePatientMasterId('isolationPrecaution', tx.isolationPrecaution);

    // === 16. Blood bank ===
    await cascadePatientMasterId('bloodBankRequest', tx.bloodBankRequest);
    await cascadePatientMasterId('transfusion', tx.transfusion);
    // BloodUnit uses `reservedFor` (not patientMasterId) to reference patient
    {
      const bloodUnitResult = await tx.bloodUnit.updateMany({
        where: { tenantId, reservedFor: sourcePatientId },
        data: { reservedFor: targetPatientId },
      });
      counts['bloodUnit'] = bloodUnitResult.count;
    }

    // === 17. Care gaps ===
    await cascadePatientMasterId('careGap', tx.careGap);

    // === 18. Care path (unique constraint: skip duplicates via raw SQL) ===
    await tx.$executeRaw`
      UPDATE "daily_care_paths"
      SET "patientMasterId" = ${targetPatientId}::uuid
      WHERE "tenantId" = ${tenantId}::uuid
        AND "patientMasterId" = ${sourcePatientId}::uuid
        AND NOT EXISTS (
          SELECT 1 FROM "daily_care_paths" t
          WHERE t."tenantId" = ${tenantId}::uuid
            AND t."patientMasterId" = ${targetPatientId}::uuid
            AND t."date" = "daily_care_paths"."date"
            AND t."departmentType" = "daily_care_paths"."departmentType"
        )
    `;
    // Delete remaining source duplicates that couldn't be moved
    await tx.dailyCarePath.deleteMany({
      where: { tenantId, patientMasterId: sourcePatientId },
    });

    // === 19. Consumables ===
    await cascadePatientMasterId('consumableStockMovement', tx.consumableStockMovement);
    await cascadePatientMasterId('consumableUsageEvent', tx.consumableUsageEvent);

    // === 20. Core (sessions, break-the-glass) ===
    await cascadePatientMasterId('patientPortalSession', tx.patientPortalSession);
    await cascadePatientId('breakTheGlassRequest', tx.breakTheGlassRequest);

    // === 21. EHR Admin ===
    await cascadePatientId('ehrEncounter', tx.ehrEncounter);
    await cascadePatientId('ehrOrder', tx.ehrOrder);
    await cascadePatientId('ehrNote', tx.ehrNote);
    await cascadePatientId('ehrTask', tx.ehrTask);

    // === 22. Integration ===
    // integrationAdtEvent.patientId stores HL7 external patient IDs, not PatientMaster UUIDs — skip

    // === 23. Misc (dental, obgyn, patient experience, etc.) ===
    await cascadePatientId('departmentEntry', tx.departmentEntry);
    await cascadePatientMasterId('identityLookup', tx.identityLookup);
    // DentalChart: unique constraint handled above (pre-transaction delete)
    await cascadePatientId('dentalChart', tx.dentalChart);
    await cascadePatientId('dentalTreatment', tx.dentalTreatment);
    await cascadePatientId('obgynForm', tx.obgynForm);
    await cascadePatientId('patientExperience', tx.patientExperience);
    await cascadePatientId('dentalProcedure', tx.dentalProcedure);
    await cascadePatientId('periodontalRecord', tx.periodontalRecord);
    await cascadePatientId('periodontalChart', tx.periodontalChart);
    await cascadePatientId('orthodonticCase', tx.orthodonticCase);

    // === 24. Oncology ===
    await cascadePatientMasterId('oncologyPatient', tx.oncologyPatient);
    // chemoCycle.patientId references OncologyPatient.id (not PatientMaster.id) and follows
    // the OncologyPatient record which itself gets reassigned above — no direct cascade needed
    await cascadePatientMasterId('tumorBoardCase', tx.tumorBoardCase);
    await cascadePatientMasterId('ctcaeToxicityRecord', tx.ctcaeToxicityRecord);
    await cascadePatientMasterId('tnmStaging', tx.tnmStaging);
    await cascadePatientMasterId('radiationTherapyPlan', tx.radiationTherapyPlan);

    // === 25. OR (operating room) ===
    await cascadePatientMasterId('orCase', tx.orCase);
    await cascadePatientMasterId('orSpecimenLog', tx.orSpecimenLog);

    // === 26. Pathology ===
    await cascadePatientMasterId('pathologySpecimen', tx.pathologySpecimen);

    // === 27. Physiotherapy ===
    await cascadePatientMasterId('ptReferral', tx.ptReferral);

    // === 28. Portal ===
    await cascadePatientMasterId('patientPortalUser', tx.patientPortalUser);
    await cascadePatientMasterId('patientPortalPendingRegistration', tx.patientPortalPendingRegistration);
    await cascadePatientId('patientConversation', tx.patientConversation);
    // PatientClinicalHistory: unique constraint handled above (pre-transaction delete)
    await cascadePatientId('patientClinicalHistory', tx.patientClinicalHistory);
    await cascadePatientId('patientChatSession', tx.patientChatSession);
    await cascadePatientId('patientExplainHistory', tx.patientExplainHistory);

    // === 29. Psychiatry ===
    await cascadePatientMasterId('psychiatricAssessment', tx.psychiatricAssessment);
    await cascadePatientMasterId('psychMedication', tx.psychMedication);
    await cascadePatientMasterId('psychRestraintLog', tx.psychRestraintLog);
    await cascadePatientMasterId('psychRiskAssessment', tx.psychRiskAssessment);
    await cascadePatientMasterId('psychMentalStatusExam', tx.psychMentalStatusExam);
    await cascadePatientMasterId('psychTreatmentPlan', tx.psychTreatmentPlan);
    await cascadePatientMasterId('psychProgressNote', tx.psychProgressNote);
    await cascadePatientMasterId('psychScaleAdministration', tx.psychScaleAdministration);
    await cascadePatientMasterId('psychInvoluntaryHold', tx.psychInvoluntaryHold);
    // psychGroupDefinition: patientMasterId is inside JSON (roster), not a direct field — skip
    // psychGroupSession: patientMasterId is inside JSON (attendance), not a direct field — skip

    // === 30. Quality ===
    await cascadePatientMasterId('sentinelEvent', tx.sentinelEvent);
    // CareGapFinding: unique constraint — use raw SQL to skip duplicates
    await tx.$executeRaw`
      UPDATE "care_gap_findings"
      SET "patientId" = ${targetPatientId}::uuid
      WHERE "tenantId" = ${tenantId}::uuid
        AND "patientId" = ${sourcePatientId}::uuid
        AND NOT EXISTS (
          SELECT 1 FROM "care_gap_findings" t
          WHERE t."tenantId" = ${tenantId}::uuid
            AND t."patientId" = ${targetPatientId}::uuid
            AND t."ruleId" = "care_gap_findings"."ruleId"
            AND t."gapType" = "care_gap_findings"."gapType"
        )
    `;
    await tx.careGapFinding.deleteMany({
      where: { tenantId, patientId: sourcePatientId },
    });
    await cascadePatientId('readmissionRecord', tx.readmissionRecord);
    await cascadePatientId('cdoOutcomeEvent', tx.cdoOutcomeEvent);
    await cascadePatientId('clinicalDecisionPrompt', tx.clinicalDecisionPrompt);
    await cascadePatientMasterId('mortalityReview', tx.mortalityReview);

    // === 31. Referrals ===
    await cascadePatientMasterId('referral', tx.referral);
    await cascadePatientMasterId('mortuaryCase', tx.mortuaryCase);

    // === 32. Reminders ===
    await cascadePatientMasterId('appointmentReminder', tx.appointmentReminder);

    // === 33. Scheduling ===
    await cascadePatientId('multiResourceBooking', tx.multiResourceBooking);
    await cascadePatientId('schedulingWaitlist', tx.schedulingWaitlist);

    // === 34. Telemedicine ===
    await cascadePatientMasterId('teleConsultation', tx.teleConsultation);
    await cascadePatientId('teleVisit', tx.teleVisit);
    await cascadePatientId('telePrescription', tx.telePrescription);
    await cascadePatientId('rpmDevice', tx.rpmDevice);
    await cascadePatientId('rpmReading', tx.rpmReading);
    await cascadePatientId('rpmThreshold', tx.rpmThreshold);

    // === 35. Transplant ===
    await cascadePatientMasterId('transplantCase', tx.transplantCase);
    await cascadePatientMasterId('transplantWaitlistEntry', tx.transplantWaitlistEntry);

    // === 36. Workflow ===
    await cascadePatientId('workflowEscalationLog', tx.workflowEscalationLog);
    await cascadePatientId('clinicalPathwayInstance', tx.clinicalPathwayInstance);

    return counts;
  }, { timeout: 30000 }); // 30s timeout for large merges

  // ---------------------------------------------------------------------------
  // Audit log — outside transaction so merge succeeds even if audit insert fails
  // ---------------------------------------------------------------------------
  const totalCascaded = Object.values(cascadeResults).reduce((a, b) => a + b, 0);

  await createAuditLog(
    'patient_merge',
    `${sourcePatientId}:${targetPatientId}`,
    'MERGE',
    userId || 'system',
    user?.email,
    {
      sourcePatientId,
      targetPatientId,
      reason,
      mergedAt: now.toISOString(),
      userId: userId || 'system',
      totalCascadedRecords: totalCascaded,
      cascadeDetails: cascadeResults,
    },
    tenantId
  );

  return NextResponse.json({
    success: true,
    sourcePatientId,
    targetPatientId,
    mergedAt: now.toISOString(),
    totalCascadedRecords: totalCascaded,
    cascadeDetails: cascadeResults,
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'patients.master.merge' }
);
