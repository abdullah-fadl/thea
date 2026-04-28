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

  const obsRows = await prisma.erObservation.findMany({
    where: { tenantId, encounterId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const nurseIds = obsRows.map((o: any) => o.nurseId).filter(Boolean);
  const userRows = nurseIds.length
    ? await prisma.user.findMany({
        where: { id: { in: nurseIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : [];

  const userMap = new Map(userRows.map((u) => [u.id, u]));

  const normalized = obsRows.map((o: any) => {
    const nurse = userMap.get(o.nurseId);
    const nurseName = nurse
      ? `${String(nurse.firstName || '').trim()} ${String(nurse.lastName || '').trim()}`.trim()
      : '';
    const nurseEmail = nurse?.email || null;
    const nurseDisplay =
      nurseName ||
      String(nurseEmail || '').trim() ||
      String(o.nurseId || '').trim() ||
      '\u2014';
    return {
      id: o.id,
      createdAt: o.createdAt,
      vitals: o.vitals,
      painScore: o.painScore,
      avpu: o.avpu,
      critical: o.critical,
      nurseId: o.nurseId,
      nurseName,
      nurseEmail,
      nurseDisplay,
    };
  });

  return NextResponse.json({ items: normalized });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
