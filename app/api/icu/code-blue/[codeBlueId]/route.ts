import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const codeBlueId = String((params as Record<string, string> | undefined)?.codeBlueId || '').trim();
    if (!codeBlueId) return NextResponse.json({ error: 'Missing codeBlueId' }, { status: 400 });

    const event = await prisma.icuCodeBlue.findFirst({
      where: { id: codeBlueId, tenantId },
    });

    if (!event) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ event });
  }),
  { permissionKey: 'icu.view' },
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const codeBlueId = String((params as Record<string, string> | undefined)?.codeBlueId || '').trim();
    if (!codeBlueId) return NextResponse.json({ error: 'Missing codeBlueId' }, { status: 400 });

    const existing = await prisma.icuCodeBlue.findFirst({
      where: { id: codeBlueId, tenantId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await req.json();

    const updateData: any = {};

    // Team fields
    if (body.teamLeader !== undefined) updateData.teamLeader = body.teamLeader;
    if (body.cprProvider1 !== undefined) updateData.cprProvider1 = body.cprProvider1;
    if (body.cprProvider2 !== undefined) updateData.cprProvider2 = body.cprProvider2;
    if (body.airwayManager !== undefined) updateData.airwayManager = body.airwayManager;
    if (body.medicationNurse !== undefined) updateData.medicationNurse = body.medicationNurse;
    if (body.recorder !== undefined) updateData.recorder = body.recorder;

    // Timeline events (replace entire array)
    if (body.timelineEvents !== undefined) {
      updateData.timelineEvents = JSON.stringify(body.timelineEvents);
    }

    // Defibrillations
    if (body.defibrillations !== undefined) {
      updateData.defibrillations = JSON.stringify(body.defibrillations);
    }

    // Medications
    if (body.medications !== undefined) {
      updateData.medications = JSON.stringify(body.medications);
    }

    // Airway
    if (body.airwayType !== undefined) updateData.airwayType = body.airwayType;
    if (body.intubationTime !== undefined) updateData.intubationTime = body.intubationTime ? new Date(body.intubationTime) : null;
    if (body.intubatedBy !== undefined) updateData.intubatedBy = body.intubatedBy;

    // Outcome
    if (body.outcome !== undefined) updateData.outcome = body.outcome;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.roscTime !== undefined) updateData.roscTime = body.roscTime ? new Date(body.roscTime) : null;
    if (body.timeOfDeath !== undefined) updateData.timeOfDeath = body.timeOfDeath ? new Date(body.timeOfDeath) : null;
    if (body.postRoscPlan !== undefined) updateData.postRoscPlan = body.postRoscPlan;

    // Family notification
    if (body.familyNotified !== undefined) updateData.familyNotified = body.familyNotified;
    if (body.familyNotifiedAt !== undefined) updateData.familyNotifiedAt = body.familyNotifiedAt ? new Date(body.familyNotifiedAt) : null;
    if (body.familyNotifiedBy !== undefined) updateData.familyNotifiedBy = body.familyNotifiedBy;

    // Debrief
    if (body.debriefDone !== undefined) updateData.debriefDone = body.debriefDone;
    if (body.debriefNotes !== undefined) updateData.debriefNotes = body.debriefNotes;

    // Location / rhythm
    if (body.location !== undefined) updateData.location = body.location;
    if (body.initialRhythm !== undefined) updateData.initialRhythm = body.initialRhythm;

    const event = await prisma.icuCodeBlue.update({
      where: { id: codeBlueId },
      data: updateData,
    });

    return NextResponse.json({ event });
  }),
  { permissionKey: 'icu.view' },
);
