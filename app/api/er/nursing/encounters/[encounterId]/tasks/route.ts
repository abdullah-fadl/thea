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

  const items = await prisma.erTask.findMany({
    where: { tenantId, encounterId },
    select: {
      id: true,
      encounterId: true,
      label: true,
      taskType: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const now = Date.now();
  const out = (items || []).map((t: any) => {
    const createdAt = t.createdAt ? new Date(t.createdAt) : null;
    const ageMinutes =
      createdAt && !Number.isNaN(createdAt.getTime())
        ? Math.max(0, Math.floor((now - createdAt.getTime()) / 60000))
        : null;
    const status = String(t.status || '');
    const isOverdue =
      typeof ageMinutes === 'number' &&
      ((status === 'ORDERED' && ageMinutes > 30) || (status === 'IN_PROGRESS' && ageMinutes > 60));
    return {
      taskId: t.id,
      encounterId: t.encounterId,
      taskName: t.label || 'Task',
      kind: t.taskType || null,
      status: t.status || null,
      createdAt: t.createdAt || null,
      ageMinutes,
      isOverdue,
    };
  });

  return NextResponse.json({ items: out });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
