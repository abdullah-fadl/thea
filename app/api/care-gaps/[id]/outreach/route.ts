import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/care-gaps/[id]/outreach
 *
 * Log an outreach attempt for a care gap.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    // Extract care gap id from the URL path
    const segments = req.nextUrl.pathname.split('/');
    const outreachIdx = segments.indexOf('outreach');
    const careGapId = outreachIdx > 0 ? segments[outreachIdx - 1] : null;

    if (!careGapId) {
      return NextResponse.json({ error: 'Care gap ID required' }, { status: 400 });
    }

    // Verify the care gap exists and belongs to this tenant
    const gap = await prisma.careGap.findFirst({
      where: { id: careGapId, tenantId },
    });

    if (!gap) {
      return NextResponse.json({ error: 'Care gap not found' }, { status: 404 });
    }

    if (gap.status === 'RESOLVED' || gap.status === 'DISMISSED') {
      return NextResponse.json(
        { error: 'Cannot log outreach for a resolved or dismissed care gap' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      outreachType,
      channel,
      message,
      messageAr,
      status,
      outcome,
      outcomeNotes,
    } = body;

    if (!outreachType) {
      return NextResponse.json(
        { error: 'outreachType is required (SMS, CALL, WHATSAPP, EMAIL)' },
        { status: 400 }
      );
    }

    const validTypes = ['SMS', 'CALL', 'WHATSAPP', 'EMAIL'];
    if (!validTypes.includes(outreachType)) {
      return NextResponse.json(
        { error: `Invalid outreachType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Create the outreach log
    const log = await prisma.careGapOutreachLog.create({
      data: {
        tenantId,
        careGapId,
        outreachType,
        channel: channel || null,
        message: message || null,
        messageAr: messageAr || null,
        status: status || 'SENT',
        outcome: outcome || null,
        outcomeNotes: outcomeNotes || null,
        performedBy: userId,
        performedByName: ((user as unknown as Record<string, unknown>)?.displayName as string) || ((user as unknown as Record<string, unknown>)?.name as string) || null,
      },
    });

    // Update the care gap's outreach tracking
    const updateData: Record<string, unknown> = {
      lastOutreachAt: new Date(),
      outreachCount: { increment: 1 },
    };

    // Auto-transition from OPEN to CONTACTED on first outreach
    if (gap.status === 'OPEN') {
      updateData.status = 'CONTACTED';
    }

    // If outcome indicates scheduling, transition to SCHEDULED
    if (outcome === 'RESCHEDULED' || outcome === 'PATIENT_WILL_COME') {
      updateData.status = 'SCHEDULED';
    }

    await prisma.careGap.update({
      where: { id: careGapId },
      data: updateData,
    });

    return NextResponse.json({ ok: true, log }, { status: 201 });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKeys: ['opd.visit.edit', 'opd.doctor.encounter.view'],
  }
);
