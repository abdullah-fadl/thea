import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isDevAccount(_email: string | null | undefined): boolean {
  return false; // backdoor removed
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }, params) => {
  const routeParams = params || {};
  const encounterId = String((routeParams as Record<string, string>).encounterId || '');
  if (!encounterId) {
    return NextResponse.json({ error: 'Encounter ID is required' }, { status: 400 });
  }

  const dev = false;
  if (!dev) {
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
        { error: 'Forbidden: only Primary Nurse can view transfer requests' },
        { status: 403 }
      );
    }
  }

  const transferRows = await prisma.erNursingTransferRequest.findMany({
    where: { tenantId, encounterId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const requestedByUserIds = transferRows
    .map((r: any) => r.requestedByUserId)
    .filter(Boolean);

  const userRows = requestedByUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: requestedByUserIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : [];

  const userMap = new Map(userRows.map((u) => [u.id, u]));

  const normalized = transferRows.map((r: any) => {
    const requestedBy = userMap.get(r.requestedByUserId);
    const requestedByName = requestedBy
      ? `${String(requestedBy.firstName || '').trim()} ${String(requestedBy.lastName || '').trim()}`.trim()
      : '';
    const requestedByEmail = requestedBy?.email || null;
    const requestedByDisplay =
      requestedByName ||
      String(requestedByEmail || '').trim() ||
      String(r.requestedByUserId || '').trim() ||
      '\u2014';
    return {
      id: r.id,
      createdAt: r.createdAt,
      status: r.status,
      urgency: r.urgency,
      reason: r.reason,
      requestedByUserId: r.requestedByUserId,
      requestedByName,
      requestedByEmail,
      requestedByDisplay,
    };
  });

  return NextResponse.json({ items: normalized });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
