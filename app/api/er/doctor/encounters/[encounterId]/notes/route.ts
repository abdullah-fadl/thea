import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { ErStaffAssignmentRole } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }, params) => {

  const routeParams = params || {};
  const encounterId = String((routeParams as Record<string, string>).encounterId || '').trim();
  if (!encounterId) return NextResponse.json({ error: 'Encounter ID is required' }, { status: 400 });

  const encounter = await prisma.erEncounter.findFirst({ where: { tenantId, id: encounterId } });
  if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });

  const assignment = await prisma.erStaffAssignment.findFirst({
    where: {
      encounterId,
      role: ErStaffAssignmentRole.PRIMARY_DOCTOR,
      unassignedAt: null,
      userId,
    },
  });
  const isDoctorOfRecord = Boolean(assignment) || String((encounter as Record<string, unknown>).seenByDoctorUserId || '') === userId;
  if (!isDoctorOfRecord) {
    return NextResponse.json({ error: 'Forbidden: not doctor-of-record for this encounter' }, { status: 403 });
  }

  // Fetch doctor notes for this encounter
  const notes = await prisma.erDoctorNote.findMany({
    where: { encounterId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Fetch user info for note authors
  const authorIds = [...new Set(notes.map(n => n.authorId))];
  const users = authorIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: authorIds } } })
    : [];
  const userMap = new Map(users.map(u => [u.id, u]));

  const normalized = notes.map((n: any) => {
    const author = userMap.get(n.authorId);
    const authorAny = author as Record<string, unknown>;
    const createdByName = authorAny
      ? `${authorAny.firstName || ''} ${authorAny.lastName || ''}`.trim()
      : '';
    const createdByEmail = authorAny?.email || null;

    return {
      id: n.id,
      encounterId: n.encounterId,
      type: n.noteType,
      content: n.freeText || n.assessment || n.plan || n.subjective || n.objective || '',
      createdAt: n.createdAt,
      createdByUserId: n.authorId,
      createdByName,
      createdByEmail,
      doctorDisplay:
        createdByName ||
        String(createdByEmail || '').trim() ||
        String(n.authorId || '').trim() ||
        '\u2014',
    };
  });

  return NextResponse.json({ items: normalized });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
