import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const patientId = String((params as { id?: string } | undefined)?.id || '').trim();
  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
  }

  const where: any = {
    tenantId,
    patientId,
    status: { in: ['OPEN', 'COMPLETED'] },
  };

  const count = await prisma.opdEncounter.count({ where });

  const lastVisit = await prisma.opdEncounter.findFirst({
    where,
    orderBy: { createdAt: 'desc' },
  });

  let visitType: 'NEW' | 'FOLLOW_UP' = 'NEW';
  if (count > 0 && lastVisit) {
    const lastVisitDate = new Date(lastVisit.createdAt);
    const daysSinceLastVisit = Math.floor(
      (Date.now() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastVisit <= 30) {
      visitType = 'FOLLOW_UP';
    }
  }

  return NextResponse.json({
    count,
    visitType,
    lastVisitDate: lastVisit?.createdAt,
    isFirstVisit: count === 0,
  });
}),
  { tenantScoped: true, permissionKey: 'clinical.view' }
);
