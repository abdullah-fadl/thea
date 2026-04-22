import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const partogramId = String((params as Record<string, string>)?.id || '').trim();
    if (!partogramId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const body = await req.json();
    const obs = await prisma.partogramObservation.create({
      data: {
        tenantId,
        partogramId,
        observedAt: body.observedAt ? new Date(body.observedAt) : new Date(),
        observedBy: body.observedBy || userId,
        bp: body.bp || null,
        pulse: body.pulse != null ? Number(body.pulse) : null,
        temperature: body.temperature != null ? Number(body.temperature) : null,
        urineOutput: body.urineOutput != null ? Number(body.urineOutput) : null,
        fhr: body.fhr != null ? Number(body.fhr) : null,
        fhrPattern: body.fhrPattern || null,
        cervixDilation: body.cervixDilation != null ? Number(body.cervixDilation) : null,
        effacement: body.effacement != null ? Number(body.effacement) : null,
        stationLevel: body.stationLevel || null,
        contractionFreq: body.contractionFreq != null ? Number(body.contractionFreq) : null,
        contractionDuration: body.contractionDuration != null ? Number(body.contractionDuration) : null,
        contractionStrength: body.contractionStrength || null,
        oxytocin: body.oxytocin != null ? Number(body.oxytocin) : null,
        medications: body.medications ?? null,
        notes: body.notes || null,
      },
    });
    return NextResponse.json({ observation: obs }, { status: 201 });
  }),
  { permissionKey: 'obgyn.manage' },
);
