import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requirePortalSession } from '@/lib/portal/auth';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FLOW_STATE_LABELS: Record<string, { ar: string; en: string; step: number }> = {
  ARRIVED:                 { ar: '\u0648\u0635\u0644',             en: 'Arrived',                  step: 1 },
  WAITING_NURSE:           { ar: '\u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u062a\u0645\u0631\u064a\u0636', en: 'Waiting for Nurse',        step: 2 },
  IN_NURSING:              { ar: '\u0641\u064a \u0627\u0644\u062a\u0645\u0631\u064a\u0636',      en: 'In Nursing',               step: 3 },
  READY_FOR_DOCTOR:        { ar: '\u062c\u0627\u0647\u0632 \u0644\u0644\u0637\u0628\u064a\u0628',     en: 'Ready for Doctor',         step: 4 },
  WAITING_DOCTOR:          { ar: '\u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u0637\u0628\u064a\u0628',  en: 'Waiting for Doctor',       step: 5 },
  IN_DOCTOR:               { ar: '\u0645\u0639 \u0627\u0644\u0637\u0628\u064a\u0628',       en: 'With Doctor',              step: 6 },
  PROCEDURE_PENDING:       { ar: '\u0625\u062c\u0631\u0627\u0621 \u0645\u0639\u0644\u0642',      en: 'Procedure Pending',        step: 7 },
  PROCEDURE_DONE_WAITING:  { ar: '\u062a\u0645 \u0627\u0644\u0625\u062c\u0631\u0627\u0621',      en: 'Procedure Done',           step: 8 },
  COMPLETED:               { ar: '\u0645\u0643\u062a\u0645\u0644\u0629',          en: 'Completed',                step: 9 },
};

const TOTAL_STEPS = 9;

export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { bookingId: string } }
) => {
  const payload = await requirePortalSession(request);
  if (payload instanceof NextResponse) return payload;

  const bookingId = String(params.bookingId || '').trim();
  if (!bookingId) {
    return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
  }

  const portalUser = await prisma.patientPortalUser.findFirst({
    where: { tenantId: payload.tenantId, id: payload.portalUserId },
  });
  if (!portalUser) {
    return NextResponse.json({ error: 'Portal user not found' }, { status: 404 });
  }

  const booking = await prisma.opdBooking.findFirst({
    where: { tenantId: payload.tenantId, id: bookingId },
  });
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Ownership check
  const portalUserRecord = portalUser as Record<string, unknown>;
  const bookingRecord = booking as Record<string, unknown>;
  const isOwner =
    (portalUserRecord.patientMasterId && bookingRecord.patientMasterId === portalUserRecord.patientMasterId) ||
    bookingRecord.portalUserId === portalUserRecord.id;
  if (!isOwner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const encounterCoreId = String(bookingRecord.encounterCoreId || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({
      flowState: null,
      label: null,
      step: 0,
      totalSteps: TOTAL_STEPS,
      queuePosition: null,
      estimatedWaitMin: null,
    });
  }

  const opd = await prisma.opdEncounter.findFirst({
    where: { tenantId: payload.tenantId, encounterCoreId },
  });
  if (!opd) {
    return NextResponse.json({
      flowState: null,
      label: null,
      step: 0,
      totalSteps: TOTAL_STEPS,
      queuePosition: null,
      estimatedWaitMin: null,
    });
  }

  const opdRecord = opd as Record<string, unknown>;
  const flowState = String(opdRecord.opdFlowState || '').trim().toUpperCase();
  const meta = FLOW_STATE_LABELS[flowState] || null;

  // Calculate queue position for waiting states
  let queuePosition: number | null = null;
  let estimatedWaitMin: number | null = null;
  const waitingStates = ['WAITING_NURSE', 'READY_FOR_DOCTOR', 'WAITING_DOCTOR'];
  if (waitingStates.includes(flowState) && bookingRecord.resourceId) {
    const ahead = await prisma.opdEncounter.count({
      where: {
        tenantId: payload.tenantId,
        opdFlowState: { in: ['ARRIVED', 'WAITING_NURSE', 'READY_FOR_DOCTOR', 'WAITING_DOCTOR'] },
        arrivedAt: { lt: (opdRecord.arrivedAt || opdRecord.createdAt) as Date },
      },
    });
    queuePosition = ahead + 1;
    estimatedWaitMin = queuePosition * 15;
  }

  return NextResponse.json({
    flowState: flowState || null,
    label: meta ? { ar: meta.ar, en: meta.en } : null,
    step: meta?.step || 0,
    totalSteps: TOTAL_STEPS,
    queuePosition,
    estimatedWaitMin,
  });
});
