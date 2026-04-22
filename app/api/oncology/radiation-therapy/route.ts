import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler, BadRequestError, NotFoundError } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';
import { calculateEstimatedEndDate } from '@/lib/oncology/radiationDefinitions';

// =============================================================================
// GET /api/oncology/radiation-therapy
// List radiation therapy plans. Filters: patientMasterId, status, technique
// =============================================================================
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const { searchParams } = new URL(req.url);
    const patientMasterId = searchParams.get('patientMasterId');
    const status = searchParams.get('status');
    const technique = searchParams.get('technique');

    const where: any = { tenantId };
    if (patientMasterId) where.patientMasterId = patientMasterId;
    if (status) where.status = status;
    if (technique) where.technique = technique;

    const plans = await (prisma as any).radiationTherapyPlan.findMany({
      where,
      include: {
        sessions: {
          select: { id: true, fractionNumber: true, status: true, deliveredDoseGy: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Attach computed session count and total delivered dose
    const enrichedPlans = plans.map((plan: any) => {
      const completedSessions = (plan.sessions || []).filter(
        (s: any) => s.status === 'COMPLETED',
      );
      return {
        ...plan,
        sessionCount: (plan.sessions || []).length,
        completedFractions: completedSessions.length,
        totalDeliveredDoseGy: completedSessions.reduce(
          (sum: number, s: any) => sum + (s.deliveredDoseGy || 0),
          0,
        ),
      };
    });

    return NextResponse.json({ plans: enrichedPlans });
  }),
  { permissionKey: 'oncology.view' },
);

// =============================================================================
// POST /api/oncology/radiation-therapy
// Create a new radiation therapy plan
// =============================================================================
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    const body = await req.json();

    // Validate required fields
    if (!body.patientMasterId) throw new BadRequestError('patientMasterId is required');
    if (!body.planName) throw new BadRequestError('planName is required');
    if (!body.technique) throw new BadRequestError('technique is required');
    if (!body.totalDoseGy || body.totalDoseGy <= 0) throw new BadRequestError('totalDoseGy must be positive');
    if (!body.dosePerFraction || body.dosePerFraction <= 0) throw new BadRequestError('dosePerFraction must be positive');
    if (!body.totalFractions || body.totalFractions <= 0) throw new BadRequestError('totalFractions must be positive');

    // Auto-calculate end date
    const startDate = body.startDate ? new Date(body.startDate) : new Date();
    const frequency = body.frequency || 'DAILY_5';
    const estimatedEndDate = calculateEstimatedEndDate(
      startDate,
      Number(body.totalFractions),
      frequency,
    );

    const plan = await (prisma as any).radiationTherapyPlan.create({
      data: {
        tenantId,
        patientMasterId: body.patientMasterId,
        planName: body.planName,
        technique: body.technique,
        intent: body.intent || null,
        targetSite: body.targetSite || null,
        targetVolumes: body.targetVolumes || null,
        totalDoseGy: Number(body.totalDoseGy),
        dosePerFraction: Number(body.dosePerFraction),
        totalFractions: Number(body.totalFractions),
        completedFractions: 0,
        frequency,
        machine: body.machine || null,
        energy: body.energy || null,
        startDate,
        endDate: estimatedEndDate,
        concurrentChemo: body.concurrentChemo || null,
        oarConstraints: body.oarConstraints || null,
        status: body.status || 'PLANNED',
        suspendReason: null,
        physicist: body.physicist || null,
        oncologistId: body.oncologistId || userId,
        notes: body.notes || null,
      },
    });

    return NextResponse.json({ plan }, { status: 201 });
  }),
  { permissionKey: 'oncology.manage' },
);

// =============================================================================
// PUT /api/oncology/radiation-therapy
// Update an existing radiation therapy plan
// =============================================================================
export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const body = await req.json();
    if (!body.id) throw new BadRequestError('Plan id is required');

    // Verify plan exists and belongs to tenant
    const existing = await (prisma as any).radiationTherapyPlan.findFirst({
      where: { id: body.id, tenantId },
      include: {
        sessions: {
          where: { status: 'COMPLETED' },
          select: { id: true },
        },
      },
    });
    if (!existing) throw new NotFoundError('Radiation therapy plan not found');

    // Build update data
    const updateData: any = {};

    if (body.planName !== undefined) updateData.planName = body.planName;
    if (body.technique !== undefined) updateData.technique = body.technique;
    if (body.intent !== undefined) updateData.intent = body.intent;
    if (body.targetSite !== undefined) updateData.targetSite = body.targetSite;
    if (body.targetVolumes !== undefined) updateData.targetVolumes = body.targetVolumes;
    if (body.totalDoseGy !== undefined) updateData.totalDoseGy = Number(body.totalDoseGy);
    if (body.dosePerFraction !== undefined) updateData.dosePerFraction = Number(body.dosePerFraction);
    if (body.totalFractions !== undefined) updateData.totalFractions = Number(body.totalFractions);
    if (body.frequency !== undefined) updateData.frequency = body.frequency;
    if (body.machine !== undefined) updateData.machine = body.machine;
    if (body.energy !== undefined) updateData.energy = body.energy;
    if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate);
    if (body.concurrentChemo !== undefined) updateData.concurrentChemo = body.concurrentChemo;
    if (body.oarConstraints !== undefined) updateData.oarConstraints = body.oarConstraints;
    if (body.physicist !== undefined) updateData.physicist = body.physicist;
    if (body.oncologistId !== undefined) updateData.oncologistId = body.oncologistId;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.suspendReason !== undefined) updateData.suspendReason = body.suspendReason;

    // Handle status change
    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    // Auto-update completedFractions from session count
    updateData.completedFractions = (existing.sessions || []).length;

    // Recalculate end date if relevant fields changed
    if (body.startDate || body.totalFractions || body.frequency) {
      const start = body.startDate ? new Date(body.startDate) : existing.startDate;
      const fractions = body.totalFractions ? Number(body.totalFractions) : existing.totalFractions;
      const freq = body.frequency || existing.frequency;
      updateData.endDate = calculateEstimatedEndDate(start, fractions, freq);
    }

    const updated = await (prisma as any).radiationTherapyPlan.update({
      where: { id: body.id },
      data: updateData,
    });

    return NextResponse.json({ plan: updated });
  }),
  { permissionKey: 'oncology.manage' },
);
