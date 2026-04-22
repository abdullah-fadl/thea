import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { buildAlignmentDashboard } from '@/lib/cvision/od/strategic-alignment';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.STRATEGIC_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires STRATEGIC_READ');
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_strategic_alignment');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'dashboard';

  if (action === 'dashboard') {
    const snapshot = await buildAlignmentDashboard(tenantId);
    const saved = await col.findOne({ tenantId }, { sort: { createdAt: -1 } }) as Record<string, unknown> | null;
    const chain = saved?.alignmentChain || {
      strategyToStructure: { score: 0, evidence: [], gaps: [] },
      structureToCulture: { score: 0, evidence: [], gaps: [] },
      cultureToProcesses: { score: 0, evidence: [], gaps: [] },
      processesToPeople: { score: 0, evidence: [], gaps: [] },
      peopleToResults: { score: 0, evidence: [], gaps: [] },
    };
    const chainScores = Object.values(chain).map((c: any) => c.score || 0);
    const overall = chainScores.length > 0 ? Math.round(chainScores.reduce((s: number, v: number) => s + v, 0) / chainScores.length) : 0;
    const level = overall >= 80 ? 'FULLY_ALIGNED' : overall >= 60 ? 'MOSTLY' : overall >= 40 ? 'PARTIALLY' : 'MISALIGNED';

    return NextResponse.json({ ok: true, data: {
      strategy: saved?.strategy || { vision: '', visionAr: '', mission: '', missionAr: '', strategicObjectives: [] },
      alignmentChain: chain,
      overallAlignmentScore: overall, alignmentLevel: level,
      dataSnapshot: snapshot,
    }});
  }

  if (action === 'alignment-score') {
    const snapshot = await buildAlignmentDashboard(tenantId);
    const scores = Object.values(snapshot);
    const avg = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
    return NextResponse.json({ ok: true, data: { score: avg, snapshot } });
  }

  if (action === 'dimension') {
    const dim = searchParams.get('dim');
    const snapshot = await buildAlignmentDashboard(tenantId);
    const dimScore = (snapshot as unknown as Record<string, unknown>)[dim as string] ?? null;
    return NextResponse.json({ ok: true, data: { dimension: dim, score: dimScore } });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.strategic.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.STRATEGIC_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires STRATEGIC_WRITE');
  const db = await getCVisionDb(tenantId);
  const col = db.collection('cvision_strategic_alignment');
  const body = await request.json();
  const action = body.action;

  if (action === 'set-strategy') {
    const { vision, visionAr, mission, missionAr, strategicObjectives } = body;
    const snapshot = await buildAlignmentDashboard(tenantId);
    const period = `${new Date().getFullYear()}`;

    await col.updateOne({ tenantId, period }, {
      $set: {
        strategy: { vision: vision || '', visionAr: visionAr || '', mission: mission || '', missionAr: missionAr || '', strategicObjectives: (strategicObjectives || []).map((o: any) => ({ objectiveId: o.objectiveId || uuidv4(), ...o, linkedOKRs: o.linkedOKRs || [], linkedInitiatives: o.linkedInitiatives || [], progress: o.progress || 0, status: o.status || 'ON_TRACK' })) },
        dataSnapshot: snapshot, updatedAt: new Date(),
      },
      $setOnInsert: {
        tenantId, period,
        alignmentChain: {
          strategyToStructure: { score: 0, evidence: [], gaps: [] },
          structureToCulture: { score: 0, evidence: [], gaps: [] },
          cultureToProcesses: { score: 0, evidence: [], gaps: [] },
          processesToPeople: { score: 0, evidence: [], gaps: [] },
          peopleToResults: { score: 0, evidence: [], gaps: [] },
        },
        overallAlignmentScore: 0, alignmentLevel: 'MISALIGNED',
        createdAt: new Date(),
      },
    }, { upsert: true });
    return NextResponse.json({ ok: true });
  }

  if (action === 'link-initiative') {
    const { objectiveId, initiativeId } = body;
    if (!objectiveId || !initiativeId) return NextResponse.json({ ok: false, error: 'objectiveId and initiativeId required' }, { status: 400 });
    await col.updateOne(
      { tenantId, 'strategy.strategicObjectives.objectiveId': objectiveId },
      { $addToSet: { 'strategy.strategicObjectives.$.linkedInitiatives': initiativeId } as Record<string, unknown>, $set: { updatedAt: new Date() } },
    );
    return NextResponse.json({ ok: true });
  }

  if (action === 'update-chain') {
    const { alignmentChain } = body;
    if (!alignmentChain) return NextResponse.json({ ok: false, error: 'alignmentChain required' }, { status: 400 });
    const chainScores = Object.values(alignmentChain).map((c: any) => c.score || 0);
    const overall = chainScores.length > 0 ? Math.round(chainScores.reduce((s: number, v: number) => s + v, 0) / chainScores.length) : 0;
    const level = overall >= 80 ? 'FULLY_ALIGNED' : overall >= 60 ? 'MOSTLY' : overall >= 40 ? 'PARTIALLY' : 'MISALIGNED';
    await col.updateOne({ tenantId }, { $set: { alignmentChain, overallAlignmentScore: overall, alignmentLevel: level, updatedAt: new Date() } }, { upsert: false });
    return NextResponse.json({ ok: true, data: { overallAlignmentScore: overall, alignmentLevel: level } });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.strategic.write' });
