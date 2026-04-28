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
        { error: 'Forbidden: encounter is not assigned to you as Primary Nurse' },
        { status: 403 }
      );
    }
  }

  const handoverRows = await prisma.erNursingHandover.findMany({
    where: { tenantId, encounterId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const fromNurseIds = handoverRows.map((h: any) => h.fromNurseId).filter(Boolean);
  const userRows = fromNurseIds.length
    ? await prisma.user.findMany({
        where: { id: { in: fromNurseIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : [];

  const userMap = new Map(userRows.map((u) => [u.id, u]));

  const normalized = handoverRows.map((h: any) => {
    const fromNurse = userMap.get(h.fromNurseId);
    const fromNurseName = fromNurse
      ? `${String(fromNurse.firstName || '').trim()} ${String(fromNurse.lastName || '').trim()}`.trim()
      : '';
    const fromNurseEmail = fromNurse?.email || null;
    const fromNurseDisplay =
      fromNurseName ||
      String(fromNurseEmail || '').trim() ||
      String(h.fromNurseId || '').trim() ||
      '\u2014';
    return {
      id: h.id,
      createdAt: h.createdAt,
      type: h.type,
      sbar: h.sbar,
      fromNurseId: h.fromNurseId,
      fromNurseName,
      fromNurseEmail,
      fromNurseDisplay,
    };
  });

  return NextResponse.json({ items: normalized });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
