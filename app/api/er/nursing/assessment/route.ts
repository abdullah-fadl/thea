import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { writeErAuditLog } from '@/lib/er/audit';
import { assertEncounterNotClosedByHandoff, ER_HANDOFF_CLOSED_ERROR } from '@/lib/er/handoff';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { getFinalStatusBlock } from '@/lib/er/finalStatusGuard';
import { calculateBraden, type BradenInput } from '@/lib/clinical/bradenScale';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isDevAccount(_email: string | null | undefined): boolean {
  return false; // backdoor removed
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user }) => {
  const url = new URL(req.url);
  const encounterId = url.searchParams.get('encounterId')?.trim();
  if (!encounterId) {
    return NextResponse.json({ error: 'encounterId query param required' }, { status: 400 });
  }

  const items = await prisma.erNursingNote.findMany({
    where: { tenantId, encounterId, category: 'assessment' },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ items });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const encounterId = String(body.encounterId || '').trim();
  if (!encounterId) {
    return NextResponse.json({ error: 'encounterId is required' }, { status: 400 });
  }

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId: encounterId });
  if (deathGuard) return deathGuard;

  const encounter = await prisma.erEncounter.findFirst({ where: { tenantId, id: encounterId } });
  if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  const finalBlock = getFinalStatusBlock(encounter.status, 'nursing.assessment');
  if (finalBlock) {
    return NextResponse.json(finalBlock.body, { status: finalBlock.status });
  }

  const dev = false;
  if (!dev) {
    const assignment = await prisma.erStaffAssignment.findFirst({
      where: { encounterId, role: 'PRIMARY_NURSE', unassignedAt: null, userId },
    });
    if (!assignment) {
      return NextResponse.json(
        { error: 'Forbidden: not assigned as Primary Nurse' },
        { status: 403 },
      );
    }
  }

  try {
    await assertEncounterNotClosedByHandoff({ tenantId, encounterId });
  } catch (err: any) {
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: err?.handoffId || null }, { status: 409 });
  }

  // Braden calculation
  let bradenScore: number | null = null;
  let bradenRisk: string | null = null;
  let bradenDataNorm: any = body.bradenData || null;
  if (bradenDataNorm?.input) {
    const result = calculateBraden(bradenDataNorm.input as BradenInput);
    bradenScore = result.totalScore;
    bradenRisk = result.risk;
    bradenDataNorm = { ...bradenDataNorm, score: result.totalScore, risk: result.risk, recommendations: result.recommendations };
  }

  const now = new Date();
  const note = await prisma.erNursingNote.create({
    data: {
      tenantId,
      encounterId,
      authorId: userId || '',
      nurseId: userId || null,
      category: 'assessment',
      type: 'nursing_assessment',
      content: body.content || 'Nursing assessment recorded',
      vitals: body.vitals || undefined,
      consciousness: String(body.consciousness || '').trim() || null,
      mewsScore: typeof body.mewsScore === 'number' ? body.mewsScore : null,
      mewsLevel: typeof body.mewsLevel === 'string' ? body.mewsLevel : null,
      fallRiskScore: typeof body.fallRiskScore === 'number' ? body.fallRiskScore : null,
      fallRiskLevel: typeof body.fallRiskLevel === 'string' ? body.fallRiskLevel : null,
      gcsScore: typeof body.gcsScore === 'number' ? body.gcsScore : null,
      bradenScore,
      bradenRisk,
      painData: body.painData || undefined,
      bradenData: bradenDataNorm || undefined,
      ioData: body.ioData || undefined,
      sbarData: body.sbarData || undefined,
      familyCommData: body.familyCommData || undefined,
      proceduresData: body.proceduresData || undefined,
      nursingTasksData: body.nursingTasksData || undefined,
      marData: body.marData || undefined,
      createdAt: now,
    },
  });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'er_nursing_assessment',
    entityId: note.id,
    action: 'CREATE',
    after: { encounterId, createdAt: now },
    ip,
  });

  return NextResponse.json({ success: true, assessment: note });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
