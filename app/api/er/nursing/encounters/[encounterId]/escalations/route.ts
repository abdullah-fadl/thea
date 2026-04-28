import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }, params) => {
  const routeParams = params || {};
  const encounterId = String((routeParams as Record<string, string>).encounterId || '').trim();
  if (!encounterId) {
    return NextResponse.json({ error: 'Encounter ID is required' }, { status: 400 });
  }

  const assignment = await prisma.erStaffAssignment.findFirst({
    where: {
      encounterId,
      role: 'PRIMARY_NURSE',
      unassignedAt: null,
      userId,
    },
  });
  if (!assignment) {
    return NextResponse.json(
      { error: 'Forbidden: only Primary Nurse can view escalations' },
      { status: 403 }
    );
  }

  const escalationRows = await prisma.erEscalation.findMany({
    where: { tenantId, encounterId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const createdByUserIds = escalationRows
    .map((e: any) => e.createdByUserId)
    .filter(Boolean);

  const userRows = createdByUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: createdByUserIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : [];

  const userMap = new Map(userRows.map((u) => [u.id, u]));

  const normalized = escalationRows.map((r: any) => {
    const createdBy = userMap.get(r.createdByUserId);
    const createdByName = createdBy
      ? `${String(createdBy.firstName || '').trim()} ${String(createdBy.lastName || '').trim()}`.trim()
      : '';
    const createdByEmail = createdBy?.email || null;
    const createdByDisplay =
      createdByName ||
      String(createdByEmail || '').trim() ||
      String(r.createdByUserId || '').trim() ||
      '\u2014';
    return {
      id: r.id,
      createdAt: r.createdAt,
      status: r.status,
      urgency: r.urgency,
      reason: r.reason,
      note: r.note,
      createdByUserId: r.createdByUserId,
      createdByName,
      createdByEmail,
      createdByDisplay,
    };
  });

  const hasOpenEscalation = normalized.some((e: any) => String(e.status) === 'OPEN');

  return NextResponse.json({ items: normalized, hasOpenEscalation });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
