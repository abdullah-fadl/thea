import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';

const organismSchema = z.object({
  name: z.string().min(1),
  colonyCount: z.string().optional(),
  identificationMethod: z.string().optional(),
});

const sensitivitySchema = z.object({
  organismName: z.string().min(1),
  antibiotic: z.string().min(1),
  result: z.enum(['S', 'I', 'R']),
  mic: z.string().optional(),
  method: z.string().optional(),
});

const updateCultureSchema = z.object({
  gramStain: z.string().optional(),
  growthStatus: z.enum(['NO_GROWTH', 'GROWTH', 'CONTAMINATED']).optional(),
  organisms: z.array(organismSchema).optional(),
  sensitivities: z.array(sensitivitySchema).optional(),
  interpretation: z.string().optional(),
  clinicalSignificance: z.enum(['PATHOGEN', 'COLONIZER', 'CONTAMINANT', 'NORMAL_FLORA', 'UNDETERMINED']).optional(),
  infectionControlAlert: z.boolean().optional(),
  resistanceFlags: z.array(z.enum(['ESBL', 'MRSA', 'VRE', 'CPR', 'MDR', 'XDR', 'PDR'])).optional(),
  status: z.enum(['RECEIVED', 'IN_PROGRESS', 'PRELIMINARY', 'FINAL']).optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, params }: any) => {
    const cultureId = params?.cultureId;
    if (!cultureId) {
      return NextResponse.json({ error: 'cultureId is required' }, { status: 400 });
    }

    const culture = await prisma.labMicroCulture.findFirst({
      where: { id: cultureId, tenantId },
    });

    if (!culture) {
      return NextResponse.json({ error: 'Culture not found' }, { status: 404 });
    }

    return NextResponse.json({ culture });
  }),
  { tenantScoped: true, permissionKey: 'lab.view' },
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, params }: any) => {
    const cultureId = params?.cultureId;
    if (!cultureId) {
      return NextResponse.json({ error: 'cultureId is required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, updateCultureSchema);
    if ('error' in v) return v.error;

    const existing = await prisma.labMicroCulture.findFirst({
      where: { id: cultureId, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Culture not found' }, { status: 404 });
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      RECEIVED: ['IN_PROGRESS'],
      IN_PROGRESS: ['PRELIMINARY', 'FINAL'],
      PRELIMINARY: ['FINAL'],
      FINAL: [],
    };

    if (v.data.status && v.data.status !== existing.status) {
      const allowed = validTransitions[existing.status] ?? [];
      if (!allowed.includes(v.data.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${existing.status} to ${v.data.status}` },
          { status: 400 },
        );
      }
    }

    const updateData: any = { updatedAt: new Date(), updatedBy: userId };

    if (v.data.gramStain !== undefined) updateData.gramStain = v.data.gramStain;
    if (v.data.growthStatus !== undefined) updateData.growthStatus = v.data.growthStatus;
    if (v.data.organisms !== undefined) updateData.organisms = v.data.organisms;
    if (v.data.sensitivities !== undefined) updateData.sensitivities = v.data.sensitivities;
    if (v.data.interpretation !== undefined) updateData.interpretation = v.data.interpretation;
    if (v.data.clinicalSignificance !== undefined) updateData.clinicalSignificance = v.data.clinicalSignificance;
    if (v.data.infectionControlAlert !== undefined) updateData.infectionControlAlert = v.data.infectionControlAlert;
    if (v.data.resistanceFlags !== undefined) updateData.resistanceFlags = v.data.resistanceFlags;
    if (v.data.status !== undefined) updateData.status = v.data.status;

    // Set finalized timestamp if moving to FINAL
    if (v.data.status === 'FINAL') {
      updateData.finalizedAt = new Date();
      updateData.finalizedBy = userId;
    }

    const updated = await prisma.labMicroCulture.update({
      where: { id: cultureId },
      data: updateData,
    });

    return NextResponse.json({ success: true, culture: updated });
  }),
  { tenantScoped: true, permissionKey: 'lab.view' },
);
