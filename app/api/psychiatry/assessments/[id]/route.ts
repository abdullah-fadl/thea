import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }, params?: unknown) => {
    const id = String((params as Record<string, unknown>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const assessment = await prisma.psychiatricAssessment.findFirst({
      where: { id, tenantId },
      include: { notes: { orderBy: { noteDate: 'desc' } } },
    });
    if (!assessment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ assessment });
  }),
  { permissionKey: 'psychiatry.view' },
);

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }, params?: unknown) => {
    const id = String((params as Record<string, unknown>)?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const body = await req.json();
    const existing = await prisma.psychiatricAssessment.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const updated = await prisma.psychiatricAssessment.update({
      where: { id },
      data: {
        diagnosis: body.diagnosis ?? existing.diagnosis,
        treatmentPlan: body.treatmentPlan ?? existing.treatmentPlan,
        disposition: body.disposition ?? existing.disposition,
        riskAssessment: body.riskAssessment ?? existing.riskAssessment,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ assessment: updated });
  }),
  { permissionKey: 'psychiatry.manage' },
);
