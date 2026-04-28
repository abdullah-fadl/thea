import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

/* ------------------------------------------------------------------ */
/*  GET /api/psychiatry/group-therapy — list group definitions         */
/* ------------------------------------------------------------------ */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || undefined;
    const groupType = url.searchParams.get('groupType') || undefined;

    const where: any = { tenantId };
    if (status) where.status = status;
    if (groupType) where.groupType = groupType;

    const groups = await prisma.psychGroupDefinition.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Fetch session counts per group
    const groupIds = groups.map((g: any) => g.id);
    let sessionCounts: Record<string, number> = {};

    if (groupIds.length > 0) {
      const counts = await prisma.psychGroupSession.groupBy({
        by: ['groupId'],
        where: { tenantId, groupId: { in: groupIds } },
        _count: { id: true },
      });
      sessionCounts = (counts || []).reduce((acc: Record<string, number>, c: { groupId: string; _count?: { id: number } }) => {
        acc[c.groupId] = c._count?.id ?? 0;
        return acc;
      }, {});
    }

    const groupsWithCounts = groups.map((g: any) => ({
      ...g,
      sessionCount: sessionCounts[g.id] ?? 0,
    }));

    return NextResponse.json({ groups: groupsWithCounts });
  }),
  { permissionKey: 'psychiatry.view' },
);

/* ------------------------------------------------------------------ */
/*  POST /api/psychiatry/group-therapy — create new group definition   */
/* ------------------------------------------------------------------ */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }: { tenantId: string; userId: string; user: any | null }) => {
    const body = await req.json();

    if (!body.groupName || !body.groupType || !body.facilitatorUserId) {
      return NextResponse.json(
        { error: 'groupName, groupType, and facilitatorUserId are required' },
        { status: 400 },
      );
    }

    const validTypes = ['CBT_GROUP', 'PROCESS', 'PSYCHOEDUCATION', 'AA_NA', 'DBT_SKILLS', 'SUPPORT', 'OTHER'];
    if (!validTypes.includes(body.groupType)) {
      return NextResponse.json(
        { error: `groupType must be one of: ${validTypes.join(', ')}` },
        { status: 400 },
      );
    }

    const group = await prisma.psychGroupDefinition.create({
      data: {
        tenantId,
        groupName: body.groupName,
        groupType: body.groupType,
        description: body.description || null,
        facilitatorUserId: body.facilitatorUserId,
        facilitatorName: body.facilitatorName || null,
        coFacilitatorId: body.coFacilitatorId || null,
        coFacilitatorName: body.coFacilitatorName || null,
        schedule: body.schedule || null,
        maxParticipants: body.maxParticipants ? Number(body.maxParticipants) : null,
        location: body.location || null,
        roster: body.roster || [],
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        notes: body.notes || null,
        status: 'ACTIVE',
        createdByUserId: userId,
        createdByName: user?.name || null,
      } as any,
    });

    logger.info('Group therapy definition created', {
      tenantId,
      category: 'clinical',
      userId,
      route: '/api/psychiatry/group-therapy',
      groupId: group.id,
    });

    return NextResponse.json({ group }, { status: 201 });
  }),
  { permissionKey: 'psychiatry.manage' },
);

/* ------------------------------------------------------------------ */
/*  PUT /api/psychiatry/group-therapy — update group definition        */
/* ------------------------------------------------------------------ */
export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }: { tenantId: string; userId: string; user: any | null }) => {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await prisma.psychGroupDefinition.findFirst({
      where: { id: body.id, tenantId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const update: any = {};

    if (body.groupName !== undefined) update.groupName = body.groupName;
    if (body.groupType !== undefined) {
      const validTypes = ['CBT_GROUP', 'PROCESS', 'PSYCHOEDUCATION', 'AA_NA', 'DBT_SKILLS', 'SUPPORT', 'OTHER'];
      if (!validTypes.includes(body.groupType)) {
        return NextResponse.json(
          { error: `groupType must be one of: ${validTypes.join(', ')}` },
          { status: 400 },
        );
      }
      update.groupType = body.groupType;
    }
    if (body.description !== undefined) update.description = body.description;
    if (body.facilitatorUserId !== undefined) update.facilitatorUserId = body.facilitatorUserId;
    if (body.facilitatorName !== undefined) update.facilitatorName = body.facilitatorName;
    if (body.coFacilitatorId !== undefined) update.coFacilitatorId = body.coFacilitatorId;
    if (body.coFacilitatorName !== undefined) update.coFacilitatorName = body.coFacilitatorName;
    if (body.schedule !== undefined) update.schedule = body.schedule;
    if (body.maxParticipants !== undefined) update.maxParticipants = body.maxParticipants ? Number(body.maxParticipants) : null;
    if (body.location !== undefined) update.location = body.location;
    if (body.roster !== undefined) update.roster = body.roster;
    if (body.startDate !== undefined) update.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) update.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.notes !== undefined) update.notes = body.notes;
    if (body.status !== undefined) update.status = body.status;

    const group = await prisma.psychGroupDefinition.update({
      where: { id: body.id },
      data: update,
    });

    logger.info('Group therapy definition updated', {
      tenantId,
      category: 'clinical',
      userId,
      route: '/api/psychiatry/group-therapy',
      groupId: group.id,
      statusChange: body.status !== existing.status ? body.status : undefined,
    });

    return NextResponse.json({ group });
  }),
  { permissionKey: 'psychiatry.manage' },
);
