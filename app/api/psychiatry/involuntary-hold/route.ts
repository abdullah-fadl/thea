import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

/* ------------------------------------------------------------------ */
/*  Hold duration map (hours)                                          */
/* ------------------------------------------------------------------ */
const HOLD_DURATION_HOURS: Record<string, number> = {
  INITIAL_72H: 72,
  EXTENSION: 14 * 24, // 14 days
  COURT_ORDER: 30 * 24, // 30 days
};

/* ------------------------------------------------------------------ */
/*  GET /api/psychiatry/involuntary-hold — list holds                  */
/* ------------------------------------------------------------------ */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const url = new URL(req.url);
    const patientMasterId = url.searchParams.get('patientMasterId') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const holdType = url.searchParams.get('holdType') || undefined;

    const where: any = { tenantId };
    if (patientMasterId) where.patientMasterId = patientMasterId;
    if (status) where.status = status;
    if (holdType) where.holdType = holdType;

    const holds = await (prisma as Record<string, any>).psychInvoluntaryHold.findMany({
      where,
      orderBy: { orderedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ holds });
  }),
  { permissionKey: 'psychiatry.view' },
);

/* ------------------------------------------------------------------ */
/*  POST /api/psychiatry/involuntary-hold — create new hold            */
/* ------------------------------------------------------------------ */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }: { tenantId: string; userId: string; user: any }) => {
    const body = await req.json();

    // --- Validate required fields ---
    if (!body.patientMasterId || !body.holdType || !body.holdStartAt) {
      return NextResponse.json(
        { error: 'patientMasterId, holdType, and holdStartAt are required' },
        { status: 400 },
      );
    }

    // --- Validate hold type ---
    if (!HOLD_DURATION_HOURS[body.holdType]) {
      return NextResponse.json(
        { error: 'holdType must be one of: INITIAL_72H, EXTENSION, COURT_ORDER' },
        { status: 400 },
      );
    }

    // --- At least one danger criterion must be true ---
    const dangerToSelf = Boolean(body.dangerToSelf);
    const dangerToOthers = Boolean(body.dangerToOthers);
    const gravelyDisabled = Boolean(body.gravelyDisabled);

    if (!dangerToSelf && !dangerToOthers && !gravelyDisabled) {
      return NextResponse.json(
        { error: 'At least one criterion must be true: dangerToSelf, dangerToOthers, or gravelyDisabled' },
        { status: 400 },
      );
    }

    // --- Calculate hold expiry ---
    const holdStartAt = new Date(body.holdStartAt);
    const durationHours = HOLD_DURATION_HOURS[body.holdType];
    const holdExpiresAt = new Date(holdStartAt.getTime() + durationHours * 60 * 60 * 1000);

    const now = new Date();

    const hold = await (prisma as Record<string, any>).psychInvoluntaryHold.create({
      data: {
        tenantId,
        patientMasterId: body.patientMasterId,
        episodeId: body.episodeId || null,
        encounterId: body.encounterId || null,

        // Hold details
        holdType: body.holdType,
        status: 'ACTIVE',
        holdStartAt,
        holdExpiresAt,
        legalBasis: body.legalBasis || null,

        // Danger criteria
        dangerToSelf,
        dangerToSelfEvidence: body.dangerToSelfEvidence || null,
        dangerToOthers,
        dangerToOthersEvidence: body.dangerToOthersEvidence || null,
        gravelyDisabled,
        gravelyDisabledEvidence: body.gravelyDisabledEvidence || null,
        additionalCriteria: body.additionalCriteria || null,

        // Extension / Court order fields
        extensionReason: body.extensionReason || null,
        extensionRequested: false,
        courtOrderRef: body.courtOrderRef || null,
        courtOrderDate: body.courtOrderDate ? new Date(body.courtOrderDate) : null,

        // Notifications
        patientNotified: false,
        patientNotifiedAt: null,
        familyNotified: false,
        familyNotifiedAt: null,
        familyNotifiedBy: null,
        familyContactName: null,
        legalRepNotified: false,
        legalRepNotifiedAt: null,

        // Evaluation
        psychiatricEvalAt: null,
        psychiatricEvalBy: null,
        evalFindings: null,

        // Reviews
        reviews: [],

        // Resolution
        conversionToVoluntary: false,
        voluntaryConsentAt: null,
        resolvedAt: null,
        resolvedBy: null,
        resolutionNotes: null,

        // Notes
        notes: body.notes || null,

        // Ordering info
        orderedByUserId: userId,
        orderedByName: user?.name || null,
        orderedAt: now,
      },
    });

    logger.info('Involuntary hold created', {
      tenantId,
      category: 'clinical',
      route: '/api/psychiatry/involuntary-hold',
      holdType: body.holdType,
    });

    return NextResponse.json({ hold }, { status: 201 });
  }),
  { permissionKey: 'psychiatry.manage' },
);

/* ------------------------------------------------------------------ */
/*  PUT /api/psychiatry/involuntary-hold — update hold                 */
/* ------------------------------------------------------------------ */
export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }: { tenantId: string; userId: string; user: any }) => {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await (prisma as Record<string, any>).psychInvoluntaryHold.findFirst({
      where: { id: body.id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Hold not found' }, { status: 404 });
    }

    const update: any = {};
    const now = new Date();

    switch (body.action) {
      /* ---- Add periodic review ---- */
      case 'add_review': {
        const reviews = Array.isArray(existing.reviews) ? [...existing.reviews] : [];
        reviews.push({
          reviewDate: now.toISOString(),
          reviewedBy: user?.name || userId,
          reviewedByUserId: userId,
          justificationContinues: Boolean(body.justificationContinues),
          notes: body.reviewNotes || null,
        });
        update.reviews = reviews;
        break;
      }

      /* ---- Record psychiatric evaluation ---- */
      case 'record_eval': {
        update.psychiatricEvalAt = now;
        update.psychiatricEvalBy = body.psychiatricEvalBy || user?.name || userId;
        update.evalFindings = body.evalFindings || null;
        break;
      }

      /* ---- Notify patient ---- */
      case 'notify_patient': {
        update.patientNotified = true;
        update.patientNotifiedAt = now;
        break;
      }

      /* ---- Notify family ---- */
      case 'notify_family': {
        update.familyNotified = true;
        update.familyNotifiedAt = now;
        update.familyNotifiedBy = body.familyNotifiedBy || user?.name || userId;
        update.familyContactName = body.familyContactName || null;
        break;
      }

      /* ---- Notify legal representative ---- */
      case 'notify_legal': {
        update.legalRepNotified = true;
        update.legalRepNotifiedAt = now;
        break;
      }

      /* ---- Convert to voluntary ---- */
      case 'convert_voluntary': {
        update.status = 'CONVERTED_VOLUNTARY';
        update.conversionToVoluntary = true;
        update.voluntaryConsentAt = now;
        update.resolvedAt = now;
        update.resolvedBy = user?.name || userId;
        update.resolutionNotes = body.resolutionNotes || 'Converted to voluntary admission';
        break;
      }

      /* ---- Resolve (discharge / court-released) ---- */
      case 'resolve': {
        const allowedStatuses = ['DISCHARGED', 'COURT_RELEASED', 'EXPIRED'];
        if (!body.newStatus || !allowedStatuses.includes(body.newStatus)) {
          return NextResponse.json(
            { error: `newStatus must be one of: ${allowedStatuses.join(', ')}` },
            { status: 400 },
          );
        }
        update.status = body.newStatus;
        update.resolvedAt = now;
        update.resolvedBy = user?.name || userId;
        update.resolutionNotes = body.resolutionNotes || null;
        break;
      }

      /* ---- Request extension ---- */
      case 'request_extension': {
        update.extensionRequested = true;
        update.extensionReason = body.extensionReason || null;
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${body.action}. Allowed: add_review, record_eval, notify_patient, notify_family, notify_legal, convert_voluntary, resolve, request_extension` },
          { status: 400 },
        );
    }

    const updated = await (prisma as Record<string, any>).psychInvoluntaryHold.update({
      where: { id: body.id },
      data: update,
    });

    logger.info(`Involuntary hold updated (${body.action})`, {
      tenantId,
      category: 'clinical',
      route: '/api/psychiatry/involuntary-hold',
      holdId: body.id,
      action: body.action,
    });

    return NextResponse.json({ hold: updated });
  }),
  { permissionKey: 'psychiatry.manage' },
);
