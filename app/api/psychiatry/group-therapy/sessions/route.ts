import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

/* ------------------------------------------------------------------ */
/*  GET /api/psychiatry/group-therapy/sessions — list sessions         */
/* ------------------------------------------------------------------ */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const url = new URL(req.url);
    const groupId = url.searchParams.get('groupId') || undefined;
    const status = url.searchParams.get('status') || undefined;

    const where: any = { tenantId };
    if (groupId) where.groupId = groupId;
    if (status) where.status = status;

    const sessions = await prisma.psychGroupSession.findMany({
      where,
      orderBy: { sessionDate: 'desc' },
      take: 100,
    });

    return NextResponse.json({ sessions });
  }),
  { permissionKey: 'psychiatry.view' },
);

/* ------------------------------------------------------------------ */
/*  POST /api/psychiatry/group-therapy/sessions — create new session   */
/* ------------------------------------------------------------------ */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }: { tenantId: string; userId: string; user: any | null }) => {
    const body = await req.json();

    if (!body.groupId || !body.sessionDate || body.sessionNumber === undefined) {
      return NextResponse.json(
        { error: 'groupId, sessionDate, and sessionNumber are required' },
        { status: 400 },
      );
    }

    // Verify group exists and belongs to this tenant
    const group = await prisma.psychGroupDefinition.findFirst({
      where: { id: body.groupId, tenantId },
    });
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Calculate attendance counts from attendance array
    const attendance = Array.isArray(body.attendance) ? body.attendance : [];
    const attendedCount = attendance.filter((a: any) => a.attended === true).length;
    const absentCount = attendance.filter((a: any) => a.attended === false).length;

    const session = await prisma.psychGroupSession.create({
      data: {
        tenantId,
        groupId: body.groupId,
        groupName: group.groupName || null,
        sessionDate: new Date(body.sessionDate),
        sessionNumber: Number(body.sessionNumber),
        theme: body.theme || null,
        topicsCovered: body.topicsCovered || null,
        keyDiscussions: body.keyDiscussions || null,
        materialsUsed: body.materialsUsed || null,
        attendance,
        attendedCount,
        absentCount,
        sessionNotes: body.sessionNotes || null,
        facilitatorReflections: body.facilitatorReflections || null,
        nextSessionPlan: body.nextSessionPlan || null,
        durationMin: body.durationMin ? Number(body.durationMin) : null,
        facilitatorUserId: userId,
        facilitatorName: user?.name || null,
        status: body.status || 'SCHEDULED',
      } as any,
    });

    logger.info('Group therapy session created', {
      tenantId,
      category: 'clinical',
      userId,
      route: '/api/psychiatry/group-therapy/sessions',
      sessionId: session.id,
      groupId: body.groupId,
    });

    return NextResponse.json({ session }, { status: 201 });
  }),
  { permissionKey: 'psychiatry.manage' },
);

/* ------------------------------------------------------------------ */
/*  PUT /api/psychiatry/group-therapy/sessions — update session        */
/* ------------------------------------------------------------------ */
export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }: { tenantId: string; userId: string; user: any | null }) => {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await prisma.psychGroupSession.findFirst({
      where: { id: body.id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const update: any = {};

    if (body.sessionDate !== undefined) update.sessionDate = new Date(body.sessionDate);
    if (body.sessionNumber !== undefined) update.sessionNumber = Number(body.sessionNumber);
    if (body.theme !== undefined) update.theme = body.theme;
    if (body.topicsCovered !== undefined) update.topicsCovered = body.topicsCovered;
    if (body.keyDiscussions !== undefined) update.keyDiscussions = body.keyDiscussions;
    if (body.materialsUsed !== undefined) update.materialsUsed = body.materialsUsed;
    if (body.sessionNotes !== undefined) update.sessionNotes = body.sessionNotes;
    if (body.facilitatorReflections !== undefined) update.facilitatorReflections = body.facilitatorReflections;
    if (body.nextSessionPlan !== undefined) update.nextSessionPlan = body.nextSessionPlan;
    if (body.durationMin !== undefined) update.durationMin = body.durationMin ? Number(body.durationMin) : null;
    if (body.status !== undefined) update.status = body.status;

    // Recalculate attendance counts if attendance changed
    if (body.attendance !== undefined) {
      const attendance = Array.isArray(body.attendance) ? body.attendance : [];
      update.attendance = attendance;
      update.attendedCount = attendance.filter((a: any) => a.attended === true).length;
      update.absentCount = attendance.filter((a: any) => a.attended === false).length;
    }

    const session = await prisma.psychGroupSession.update({
      where: { id: body.id },
      data: update,
    });

    logger.info('Group therapy session updated', {
      tenantId,
      category: 'clinical',
      userId,
      route: '/api/psychiatry/group-therapy/sessions',
      sessionId: session.id,
      statusChange: body.status !== existing.status ? body.status : undefined,
    });

    return NextResponse.json({ session });
  }),
  { permissionKey: 'psychiatry.manage' },
);
