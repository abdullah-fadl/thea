import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/or/cases/[caseId]/post-op-orders
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params) => {
    try {
      const caseId = String((params as any)?.caseId || '').trim();
      if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });

      const record = await prisma.orPostOpOrder.findFirst({
        where: { tenantId, caseId },
      });

      return NextResponse.json({ postOpOrder: record ?? null });
    } catch (e: unknown) {
      logger.error('[OR post-op-orders GET]', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch post-op orders' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);

// POST /api/or/cases/[caseId]/post-op-orders
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId, user }, params) => {
    try {
      const caseId = String((params as any)?.caseId || '').trim();
      if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });

      const orCase = await prisma.orCase.findFirst({ where: { tenantId, id: caseId } });
      if (!orCase) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

      const body = await req.json();
      const userName = user?.displayName || user?.email || null;

      const record = await prisma.orPostOpOrder.upsert({
        where: { caseId },
        create: {
          tenantId,
          caseId,
          orderedByUserId: userId,
          orderedByName: userName,
          admitTo: body.admitTo ?? null,
          bedType: body.bedType ?? null,
          condition: body.condition ?? null,
          vitalFrequency: body.vitalFrequency ?? null,
          neurovascularChecks: body.neurovascularChecks ?? false,
          neurovascularFreq: body.neurovascularFreq ?? null,
          activityLevel: body.activityLevel ?? null,
          positionRestrictions: body.positionRestrictions ?? null,
          fallPrecautions: body.fallPrecautions ?? false,
          dietType: body.dietType ?? null,
          fluidRestriction: body.fluidRestriction ?? null,
          ivFluids: body.ivFluids ?? null,
          painManagement: body.painManagement ?? null,
          antibiotics: body.antibiotics ?? null,
          anticoagulation: body.anticoagulation ?? null,
          antiemetics: body.antiemetics ?? null,
          otherMedications: body.otherMedications ?? null,
          woundCareInstructions: body.woundCareInstructions ?? null,
          drainManagement: body.drainManagement ?? null,
          dressingChanges: body.dressingChanges ?? null,
          dvtProphylaxis: body.dvtProphylaxis ?? false,
          dvtMethod: body.dvtMethod ?? null,
          oxygenTherapy: body.oxygenTherapy ?? null,
          incentiveSpirometry: body.incentiveSpirometry ?? false,
          coughDeepBreath: body.coughDeepBreath ?? false,
          intakeOutputMonitoring: body.intakeOutputMonitoring ?? false,
          foleyPresent: body.foleyPresent ?? false,
          foleyRemovalPlan: body.foleyRemovalPlan ?? null,
          labOrders: body.labOrders ?? null,
          imagingOrders: body.imagingOrders ?? null,
          callDoctorIf: body.callDoctorIf ?? null,
          status: body.status ?? 'DRAFT',
        },
        update: {
          orderedByUserId: userId,
          orderedByName: userName,
          admitTo: body.admitTo ?? null,
          bedType: body.bedType ?? null,
          condition: body.condition ?? null,
          vitalFrequency: body.vitalFrequency ?? null,
          neurovascularChecks: body.neurovascularChecks ?? false,
          neurovascularFreq: body.neurovascularFreq ?? null,
          activityLevel: body.activityLevel ?? null,
          positionRestrictions: body.positionRestrictions ?? null,
          fallPrecautions: body.fallPrecautions ?? false,
          dietType: body.dietType ?? null,
          fluidRestriction: body.fluidRestriction ?? null,
          ivFluids: body.ivFluids ?? null,
          painManagement: body.painManagement ?? null,
          antibiotics: body.antibiotics ?? null,
          anticoagulation: body.anticoagulation ?? null,
          antiemetics: body.antiemetics ?? null,
          otherMedications: body.otherMedications ?? null,
          woundCareInstructions: body.woundCareInstructions ?? null,
          drainManagement: body.drainManagement ?? null,
          dressingChanges: body.dressingChanges ?? null,
          dvtProphylaxis: body.dvtProphylaxis ?? false,
          dvtMethod: body.dvtMethod ?? null,
          oxygenTherapy: body.oxygenTherapy ?? null,
          incentiveSpirometry: body.incentiveSpirometry ?? false,
          coughDeepBreath: body.coughDeepBreath ?? false,
          intakeOutputMonitoring: body.intakeOutputMonitoring ?? false,
          foleyPresent: body.foleyPresent ?? false,
          foleyRemovalPlan: body.foleyRemovalPlan ?? null,
          labOrders: body.labOrders ?? null,
          imagingOrders: body.imagingOrders ?? null,
          callDoctorIf: body.callDoctorIf ?? null,
          status: body.status ?? 'DRAFT',
          activatedAt: body.status === 'ACTIVE' ? new Date() : undefined,
        },
      });

      return NextResponse.json({ postOpOrder: record }, { status: 201 });
    } catch (e: unknown) {
      logger.error('[OR post-op-orders POST]', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to save post-op orders' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);
