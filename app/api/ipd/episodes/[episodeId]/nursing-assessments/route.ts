import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { writeErAuditLog } from '@/lib/er/audit';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';
import { calculateBraden, type BradenInput } from '@/lib/clinical/bradenScale';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  consciousness: z.string().optional(),
  painControlled: z.boolean().optional(),
  fallRisk: z.boolean().optional(),
  pressureUlcerRisk: z.boolean().optional(),
  ivLine: z.boolean().optional(),
  oxygenTherapy: z.boolean().optional(),
  mobility: z.string().optional(),
  diet: z.string().optional(),
  // Extended nursing fields
  mewsScore: z.number().optional(),
  mewsLevel: z.string().optional(),
  fallRiskScore: z.number().optional(),
  fallRiskLevel: z.string().optional(),
  gcsScore: z.number().optional(),
  painData: z.any().optional(),
  bradenData: z.any().optional(),
  ioData: z.any().optional(),
  sbarData: z.any().optional(),
  familyCommData: z.any().optional(),
  proceduresData: z.any().optional(),
  carePlanData: z.any().optional(),
  handoverData: z.any().optional(),
  nursingTasksData: z.any().optional(),
  marData: z.any().optional(),
  icuMonitoring: z.any().optional(),
}).passthrough();

function isNurse(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r.includes('nurse') || r.includes('nursing');
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user }, params) => {

  const role = String(user?.role || '');
  const dev = false;
  if (!dev && !isNurse(role) && !canAccessChargeConsole({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const routeParams = params || {};
  const episodeId = String((routeParams as Record<string, string>).episodeId || '').trim();
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
  }

  const items = await prisma.ipdNursingAssessment.findMany({
    where: { tenantId, episodeId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true, tenantId: true, episodeId: true, assessment: true,
      mewsScore: true, mewsLevel: true, fallRiskScore: true, fallRiskLevel: true,
      gcsScore: true, bradenScore: true, bradenRisk: true, consciousness: true,
      painData: true, bradenData: true, ioData: true, sbarData: true,
      familyCommData: true, proceduresData: true, carePlanData: true,
      handoverData: true, nursingTasksData: true, marData: true, icuMonitoring: true,
      createdByUserId: true, createdAt: true, updatedAt: true,
    },
  });

  return NextResponse.json({ items });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }, params) => {

  const role = String(user?.role || '');
  const dev = false;

  const routeParams = params || {};
  const episodeId = String((routeParams as Record<string, string>).episodeId || '').trim();
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }
  const encounterCoreId = String(episode.encounterId || '').trim();
  if (encounterCoreId) {
    const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
    if (deathGuard) return deathGuard;
  }

  const ownership = episode.ownership as Record<string, unknown> | null;
  const primaryNurseId = String(ownership?.primaryInpatientNurseUserId || '').trim();
  const charge = canAccessChargeConsole({ email: user?.email, tenantId, role });
  if (!dev && !charge && primaryNurseId !== String(userId || '')) {
    return NextResponse.json(
      { error: 'Forbidden: only primary nurse or charge roles can add assessments' },
      { status: 403 }
    );
  }

  const assessment = {
    consciousness: String(body.consciousness || '').trim() || null,
    painControlled: Boolean(body.painControlled),
    fallRisk: Boolean(body.fallRisk),
    pressureUlcerRisk: Boolean(body.pressureUlcerRisk),
    ivLine: Boolean(body.ivLine),
    oxygenTherapy: Boolean(body.oxygenTherapy),
    mobility: String(body.mobility || '').trim() || null,
    diet: String(body.diet || '').trim() || null,
  };

  // Braden calculation
  let bradenScore: number | null = null;
  let bradenRisk: string | null = null;
  let bradenDataNorm = (body.bradenData || null) as Record<string, unknown> | null;
  if (bradenDataNorm?.input) {
    const result = calculateBraden(bradenDataNorm.input as BradenInput);
    bradenScore = result.totalScore;
    bradenRisk = result.risk;
    bradenDataNorm = { ...bradenDataNorm, score: result.totalScore, risk: result.risk, recommendations: result.recommendations };
  }

  const now = new Date();
  const doc = await prisma.ipdNursingAssessment.create({
    data: {
      tenantId,
      episodeId,
      assessment,
      consciousness: String(body.consciousness || '').trim() || null,
      mewsScore: typeof body.mewsScore === 'number' ? body.mewsScore : null,
      mewsLevel: typeof body.mewsLevel === 'string' ? body.mewsLevel : null,
      fallRiskScore: typeof body.fallRiskScore === 'number' ? body.fallRiskScore : null,
      fallRiskLevel: typeof body.fallRiskLevel === 'string' ? body.fallRiskLevel : null,
      gcsScore: typeof body.gcsScore === 'number' ? body.gcsScore : null,
      bradenScore,
      bradenRisk,
      painData: body.painData || undefined,
      bradenData: (bradenDataNorm || undefined) as any,
      ioData: body.ioData || undefined,
      sbarData: body.sbarData || undefined,
      familyCommData: body.familyCommData || undefined,
      proceduresData: body.proceduresData || undefined,
      carePlanData: body.carePlanData || undefined,
      handoverData: body.handoverData || undefined,
      nursingTasksData: body.nursingTasksData || undefined,
      marData: body.marData || undefined,
      icuMonitoring: body.icuMonitoring || undefined,
      createdAt: now,
      createdByUserId: userId || null,
    },
  });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'ipd_nursing_assessment',
    entityId: doc.id,
    action: 'CREATE',
    after: { episodeId, assessment, createdAt: now },
    ip,
  });

  return NextResponse.json({ success: true, assessment: doc });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
