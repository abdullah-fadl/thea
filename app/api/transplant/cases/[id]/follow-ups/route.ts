import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }, params?: unknown) => {
    const caseId = String((params as Record<string, string>)?.id || '').trim();
    if (!caseId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const body = await req.json();
    const fu = await prisma.transplantFollowUp.create({
      data: {
        tenantId,
        caseId,
        visitDate: new Date(body.visitDate || Date.now()),
        daysPostTransplant: body.daysPostTransplant != null ? Number(body.daysPostTransplant) : null,
        clinicianId: body.clinicianId || userId,
        graftFunction: body.graftFunction ?? null,
        labs: body.labs ?? null,
        medications: body.medications ?? null,
        complications: body.complications ?? null,
        biopsyDone: Boolean(body.biopsyDone),
        biopsyResult: body.biopsyResult ?? null,
        plan: body.plan ?? null,
        nextVisit: body.nextVisit ? new Date(body.nextVisit) : null,
      },
    });
    return NextResponse.json({ followUp: fu }, { status: 201 });
  }),
  { permissionKey: 'transplant.manage' },
);
