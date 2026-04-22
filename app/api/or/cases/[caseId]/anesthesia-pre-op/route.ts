import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/or/cases/[caseId]/anesthesia-pre-op
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params) => {
    try {
      const caseId = String((params as any)?.caseId || '').trim();
      if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });

      const record = await prisma.orAnesthesiaPreOp.findFirst({
        where: { tenantId, caseId },
      });

      return NextResponse.json({ anesthesiaPreOp: record ?? null });
    } catch (e: unknown) {
      logger.error('[OR anesthesia-pre-op GET]', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch anesthesia pre-op' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);

// POST /api/or/cases/[caseId]/anesthesia-pre-op
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId, user }, params) => {
    try {
      const caseId = String((params as any)?.caseId || '').trim();
      if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });

      const orCase = await prisma.orCase.findFirst({ where: { tenantId, id: caseId } });
      if (!orCase) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

      const body = await req.json();
      const userName = user?.displayName || user?.email || null;

      // Check if record exists before upsert (for audit action)
      const existingRecord = await prisma.orAnesthesiaPreOp.findFirst({ where: { tenantId, caseId } });

      const record = await prisma.orAnesthesiaPreOp.upsert({
        where: { caseId },
        create: {
          tenantId,
          caseId,
          assessedByUserId: userId,
          assessedByName: userName,
          assessedAt: new Date(),
          // ASA
          asaClass: body.asaClass ?? null,
          asaEmergency: body.asaEmergency ?? false,
          // Airway
          mallampatiScore: body.mallampatiScore ?? null,
          thyroMentalDistance: body.thyroMentalDistance ?? null,
          mouthOpening: body.mouthOpening ?? null,
          neckMobility: body.neckMobility ?? null,
          dentitionStatus: body.dentitionStatus ?? null,
          beardPresent: body.beardPresent ?? false,
          predictedDifficultAirway: body.predictedDifficultAirway ?? false,
          airwayNotes: body.airwayNotes ?? null,
          // History
          cardiacHistory: body.cardiacHistory ?? null,
          respiratoryHistory: body.respiratoryHistory ?? null,
          hepaticHistory: body.hepaticHistory ?? null,
          renalHistory: body.renalHistory ?? null,
          endocrineHistory: body.endocrineHistory ?? null,
          neurologicHistory: body.neurologicHistory ?? null,
          hematologicHistory: body.hematologicHistory ?? null,
          // Previous anesthesia
          previousAnesthesia: body.previousAnesthesia ?? false,
          previousComplications: body.previousComplications ?? null,
          familyAnesthesiaHx: body.familyAnesthesiaHx ?? null,
          // Medications
          currentMedications: body.currentMedications ?? [],
          herbals: body.herbals ?? null,
          // NPO
          npoVerified: body.npoVerified ?? false,
          lastSolidsTime: body.lastSolidsTime ? new Date(body.lastSolidsTime) : null,
          lastClearLiquidsTime: body.lastClearLiquidsTime ? new Date(body.lastClearLiquidsTime) : null,
          // Planned
          plannedAnesthesiaType: body.plannedAnesthesiaType ?? null,
          plannedAirway: body.plannedAirway ?? null,
          preMedications: body.preMedications ?? [],
          // Risk
          cardiacRiskIndex: body.cardiacRiskIndex ?? null,
          pulmonaryRiskScore: body.pulmonaryRiskScore ?? null,
          bleedingRisk: body.bleedingRisk ?? null,
          ponvRisk: body.ponvRisk ?? null,
          // Consent
          risksExplained: body.risksExplained ?? false,
          consentObtained: body.consentObtained ?? false,
          // Status
          status: body.status ?? 'IN_PROGRESS',
          specialConsiderations: body.specialConsiderations ?? null,
          anesthesiaNotes: body.anesthesiaNotes ?? null,
        },
        update: {
          assessedByUserId: userId,
          assessedByName: userName,
          assessedAt: new Date(),
          asaClass: body.asaClass ?? null,
          asaEmergency: body.asaEmergency ?? false,
          mallampatiScore: body.mallampatiScore ?? null,
          thyroMentalDistance: body.thyroMentalDistance ?? null,
          mouthOpening: body.mouthOpening ?? null,
          neckMobility: body.neckMobility ?? null,
          dentitionStatus: body.dentitionStatus ?? null,
          beardPresent: body.beardPresent ?? false,
          predictedDifficultAirway: body.predictedDifficultAirway ?? false,
          airwayNotes: body.airwayNotes ?? null,
          cardiacHistory: body.cardiacHistory ?? null,
          respiratoryHistory: body.respiratoryHistory ?? null,
          hepaticHistory: body.hepaticHistory ?? null,
          renalHistory: body.renalHistory ?? null,
          endocrineHistory: body.endocrineHistory ?? null,
          neurologicHistory: body.neurologicHistory ?? null,
          hematologicHistory: body.hematologicHistory ?? null,
          previousAnesthesia: body.previousAnesthesia ?? false,
          previousComplications: body.previousComplications ?? null,
          familyAnesthesiaHx: body.familyAnesthesiaHx ?? null,
          currentMedications: body.currentMedications ?? [],
          herbals: body.herbals ?? null,
          npoVerified: body.npoVerified ?? false,
          lastSolidsTime: body.lastSolidsTime ? new Date(body.lastSolidsTime) : null,
          lastClearLiquidsTime: body.lastClearLiquidsTime ? new Date(body.lastClearLiquidsTime) : null,
          plannedAnesthesiaType: body.plannedAnesthesiaType ?? null,
          plannedAirway: body.plannedAirway ?? null,
          preMedications: body.preMedications ?? [],
          cardiacRiskIndex: body.cardiacRiskIndex ?? null,
          pulmonaryRiskScore: body.pulmonaryRiskScore ?? null,
          bleedingRisk: body.bleedingRisk ?? null,
          ponvRisk: body.ponvRisk ?? null,
          risksExplained: body.risksExplained ?? false,
          consentObtained: body.consentObtained ?? false,
          status: body.status ?? 'IN_PROGRESS',
          specialConsiderations: body.specialConsiderations ?? null,
          anesthesiaNotes: body.anesthesiaNotes ?? null,
        },
      });

      // Audit log for anesthesia pre-op assessment
      const auditAction = existingRecord ? 'UPDATE' : 'CREATE';
      await createAuditLog(
        'or_anesthesia_pre_op',
        record.id || caseId,
        auditAction,
        userId || 'system',
        user?.email,
        {
          caseId,
          asaClass: body.asaClass ?? null,
          plannedAnesthesiaType: body.plannedAnesthesiaType ?? null,
          predictedDifficultAirway: body.predictedDifficultAirway ?? false,
          consentObtained: body.consentObtained ?? false,
          status: body.status ?? 'IN_PROGRESS',
        },
        tenantId,
        req,
      );

      return NextResponse.json({ anesthesiaPreOp: record }, { status: 201 });
    } catch (e: unknown) {
      logger.error('[OR anesthesia-pre-op POST]', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to save anesthesia pre-op' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);
