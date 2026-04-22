import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler, BadRequestError, NotFoundError } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

// =============================================================================
// GET /api/oncology/radiation-therapy/sessions
// List sessions for a given planId, ordered by fractionNumber
// =============================================================================
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const { searchParams } = new URL(req.url);
    const planId = searchParams.get('planId');
    if (!planId) throw new BadRequestError('planId query parameter is required');

    // Verify plan belongs to tenant
    const plan = await prisma.radiationTherapyPlan.findFirst({
      where: { id: planId, tenantId },
      select: { id: true, totalFractions: true, totalDoseGy: true },
    });
    if (!plan) throw new NotFoundError('Radiation therapy plan not found');

    const sessions = await prisma.radiationSession.findMany({
      where: { planId, tenantId },
      orderBy: { fractionNumber: 'asc' },
      take: 100,
    });

    return NextResponse.json({ sessions, plan });
  }),
  { permissionKey: 'oncology.view' },
);

// =============================================================================
// POST /api/oncology/radiation-therapy/sessions
// Create a new session. Auto-increments fractionNumber. Updates plan.
// =============================================================================
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    const body = await req.json();
    if (!body.planId) throw new BadRequestError('planId is required');

    // Verify plan belongs to tenant
    const plan = await prisma.radiationTherapyPlan.findFirst({
      where: { id: body.planId, tenantId },
      include: {
        sessions: {
          select: { fractionNumber: true },
          orderBy: { fractionNumber: 'desc' },
          take: 1,
        },
      },
    });
    if (!plan) throw new NotFoundError('Radiation therapy plan not found');

    // Auto-increment fraction number
    const lastFraction = plan.sessions?.[0]?.fractionNumber ?? 0;
    const fractionNumber = body.fractionNumber ?? lastFraction + 1;

    // Create session
    const session = await prisma.radiationSession.create({
      data: {
        tenantId,
        planId: body.planId,
        fractionNumber,
        sessionDate: body.sessionDate ? new Date(body.sessionDate) : new Date(),
        deliveredDoseGy: body.deliveredDoseGy ? Number(body.deliveredDoseGy) : plan.dosePerFraction,
        machine: body.machine || plan.machine || null,
        technician: body.technician || null,
        setupVerification: body.setupVerification || 'CBCT',
        skinReaction: body.skinReaction || 'NONE',
        patientTolerance: body.patientTolerance || 'GOOD',
        isocenterShift: body.isocenterShift || null,
        treatmentTime: body.treatmentTime ? Number(body.treatmentTime) : null,
        notes: body.notes || null,
        status: body.status || 'COMPLETED',
      },
    });

    // Update plan completedFractions count
    const completedCount = await prisma.radiationSession.count({
      where: { planId: body.planId, tenantId, status: 'COMPLETED' },
    });

    const planUpdate: any = { completedFractions: completedCount };

    // Auto-transition plan status
    if (plan.status === 'PLANNED' && completedCount > 0) {
      planUpdate.status = 'IN_PROGRESS';
    }
    if (completedCount >= plan.totalFractions) {
      planUpdate.status = 'COMPLETED';
    }

    await prisma.radiationTherapyPlan.update({
      where: { id: body.planId },
      data: planUpdate,
    });

    return NextResponse.json({ session }, { status: 201 });
  }),
  { permissionKey: 'oncology.manage' },
);

// =============================================================================
// PUT /api/oncology/radiation-therapy/sessions
// Update an existing session
// =============================================================================
export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const body = await req.json();
    if (!body.id) throw new BadRequestError('Session id is required');

    // Verify session exists and belongs to tenant
    const existing = await prisma.radiationSession.findFirst({
      where: { id: body.id, tenantId },
    });
    if (!existing) throw new NotFoundError('Radiation session not found');

    const updateData: any = {};

    if (body.sessionDate !== undefined) updateData.sessionDate = new Date(body.sessionDate);
    if (body.deliveredDoseGy !== undefined) updateData.deliveredDoseGy = Number(body.deliveredDoseGy);
    if (body.machine !== undefined) updateData.machine = body.machine;
    if (body.technician !== undefined) updateData.technician = body.technician;
    if (body.setupVerification !== undefined) updateData.setupVerification = body.setupVerification;
    if (body.skinReaction !== undefined) updateData.skinReaction = body.skinReaction;
    if (body.patientTolerance !== undefined) updateData.patientTolerance = body.patientTolerance;
    if (body.isocenterShift !== undefined) updateData.isocenterShift = body.isocenterShift;
    if (body.treatmentTime !== undefined) updateData.treatmentTime = Number(body.treatmentTime);
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status !== undefined) updateData.status = body.status;

    const updated = await prisma.radiationSession.update({
      where: { id: body.id },
      data: updateData,
    });

    // Re-sync plan completedFractions
    const completedCount = await prisma.radiationSession.count({
      where: { planId: existing.planId, tenantId, status: 'COMPLETED' },
    });

    await prisma.radiationTherapyPlan.update({
      where: { id: existing.planId },
      data: { completedFractions: completedCount },
    });

    return NextResponse.json({ session: updated });
  }),
  { permissionKey: 'oncology.manage' },
);
