import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/or/cases/[caseId]/team
// Returns the surgical team record for this OR case
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const caseId = String((params as Record<string, string>)?.caseId || '').trim();
    if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });

    const orCase = await prisma.orCase.findFirst({ where: { tenantId, id: caseId } });
    if (!orCase) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    const team = await (prisma as Record<string, any>).orSurgicalTeam.findFirst({ where: { tenantId, caseId } });
    return NextResponse.json({ team: team ?? null });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' }
);

// PUT /api/or/cases/[caseId]/team
// Upserts the surgical team record — all fields optional, send only what changed
export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const caseId = String((params as Record<string, string>)?.caseId || '').trim();
    if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });

    const orCase = await prisma.orCase.findFirst({ where: { tenantId, id: caseId } });
    if (!orCase) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    let body: any = {};
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const str = (v: any) => (v !== undefined ? (v ? String(v).trim() : null) : undefined);

    const teamData: any = {};
    if (body.surgeon !== undefined) teamData.surgeon = str(body.surgeon);
    if (body.assistantSurgeon !== undefined) teamData.assistantSurgeon = str(body.assistantSurgeon);
    if (body.anesthesiologist !== undefined) teamData.anesthesiologist = str(body.anesthesiologist);
    if (body.scrubNurse !== undefined) teamData.scrubNurse = str(body.scrubNurse);
    if (body.circulatingNurse !== undefined) teamData.circulatingNurse = str(body.circulatingNurse);
    if (body.perfusionist !== undefined) teamData.perfusionist = str(body.perfusionist);
    if (body.specialistConsult !== undefined) teamData.specialistConsult = str(body.specialistConsult);
    if (body.notes !== undefined) teamData.notes = str(body.notes);

    const team = await (prisma as Record<string, any>).orSurgicalTeam.upsert({
      where: { caseId },
      create: { tenantId, caseId, ...teamData },
      update: teamData,
    });

    return NextResponse.json({ success: true, team });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' }
);
