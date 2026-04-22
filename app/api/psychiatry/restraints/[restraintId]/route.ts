import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

/* ------------------------------------------------------------------ */
/*  GET /api/psychiatry/restraints/[restraintId] — single restraint   */
/* ------------------------------------------------------------------ */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }, params?: unknown) => {
    const restraintId = String((params as Record<string, string>)?.restraintId || '').trim();
    if (!restraintId) return NextResponse.json({ error: 'Missing restraintId' }, { status: 400 });

    const restraint = await (prisma as Record<string, any>).psychRestraintLog.findFirst({
      where: { id: restraintId, tenantId },
    });
    if (!restraint) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ restraint });
  }),
  { permissionKey: 'psychiatry.view' },
);

/* ------------------------------------------------------------------ */
/*  PATCH /api/psychiatry/restraints/[restraintId] — update           */
/* ------------------------------------------------------------------ */
export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }: { tenantId: string; userId: string; user: any }, params?: unknown) => {
    const restraintId = String((params as Record<string, string>)?.restraintId || '').trim();
    if (!restraintId) return NextResponse.json({ error: 'Missing restraintId' }, { status: 400 });

    const existing = await (prisma as Record<string, any>).psychRestraintLog.findFirst({
      where: { id: restraintId, tenantId },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const update: any = {};

    // Add monitoring check
    if (body.addMonitoringCheck) {
      const checks = Array.isArray(existing.monitoringChecks) ? [...existing.monitoringChecks] : [];
      checks.push({
        time: new Date().toISOString(),
        checkedBy: user?.name || userId,
        checkedByUserId: userId,
        circulation: body.addMonitoringCheck.circulation ?? null,
        skinIntegrity: body.addMonitoringCheck.skinIntegrity ?? null,
        emotionalStatus: body.addMonitoringCheck.emotionalStatus ?? null,
        hydration: body.addMonitoringCheck.hydration ?? null,
        toileting: body.addMonitoringCheck.toileting ?? null,
        notes: body.addMonitoringCheck.notes ?? null,
      });
      update.monitoringChecks = checks;
    }

    // End restraint
    if (body.endRestraint) {
      const now = new Date();
      const started = new Date(existing.startedAt);
      const durationMin = Math.round((now.getTime() - started.getTime()) / 60000);
      update.endedAt = now;
      update.totalDurationMin = durationMin;
      update.status = 'COMPLETED';
      update.discontinuedReason = body.endRestraint.discontinuedReason || null;
      update.notes = body.endRestraint.notes ?? existing.notes;
    }

    // Cancel restraint
    if (body.cancel) {
      update.status = 'CANCELLED';
      update.discontinuedReason = body.cancel.reason || 'Cancelled';
    }

    // Update status directly
    if (body.status && !body.endRestraint && !body.cancel) {
      update.status = body.status;
    }

    // Physician face-to-face assessment
    if (body.physicianAssessment) {
      update.physicianAssessedAt = new Date();
      update.physicianAssessedBy = body.physicianAssessment.physicianName || user?.name || userId;
      update.physicianNotes = body.physicianAssessment.notes || null;
    }

    // Debrief
    if (body.debrief) {
      update.debriefCompleted = true;
      update.debriefNotes = body.debrief.staffNotes || null;
      update.patientDebriefNotes = body.debrief.patientNotes || null;
    }

    // Patient response / injuries
    if (body.patientResponse !== undefined) update.patientResponse = body.patientResponse;
    if (body.injuriesNoted !== undefined) {
      update.injuriesNoted = body.injuriesNoted;
      if (body.injuryDescription) update.injuryDescription = body.injuryDescription;
    }

    const updated = await (prisma as Record<string, any>).psychRestraintLog.update({
      where: { id: restraintId },
      data: update,
    });

    logger.info('Restraint log updated', { tenantId, category: 'clinical', route: `/api/psychiatry/restraints/${restraintId}` });

    return NextResponse.json({ restraint: updated });
  }),
  { permissionKey: 'psychiatry.manage' },
);
