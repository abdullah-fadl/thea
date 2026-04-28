import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { writeErAuditLog } from '@/lib/er/audit';
import { evaluateCriticalVitals } from '@/lib/er/observations';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { validateBody } from '@/lib/validation/helpers';
import { ipdVitalsSchema } from '@/lib/validation/ipd.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isNurse(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r.includes('nurse') || r.includes('nursing');
}

function toNumberOrNull(v: any): number | null {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeAvpu(v: any): 'A' | 'V' | 'P' | 'U' | null {
  const s = String(v || '').trim().toUpperCase();
  if (s === 'A' || s === 'V' || s === 'P' || s === 'U') return s;
  return null;
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

  const rawItems = await prisma.ipdVitals.findMany({
    where: { tenantId, episodeId },
    orderBy: { recordedAt: 'desc' },
    take: 200,
  });

  const items = rawItems.map((item) => {
    const vitalsData = item.vitals as Record<string, unknown> | null;
    const evalResult = evaluateCriticalVitals({
      systolic: (vitalsData?.systolic as number) ?? null,
      diastolic: (vitalsData?.diastolic as number) ?? null,
      hr: (vitalsData?.hr as number) ?? null,
      rr: (vitalsData?.rr as number) ?? null,
      temp: (vitalsData?.temp as number) ?? null,
      spo2: (vitalsData?.spo2 as number) ?? null,
      painScore: item?.painScore ?? null,
      avpu: item?.avpu as any ?? null,
    });
    return {
      ...item,
      critical: evalResult.critical,
      criticalReasons: evalResult.reasons,
    };
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

  const v = validateBody(body, ipdVitalsSchema);
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
  const roleLower = String(role || '').toLowerCase();
  const userIsNurse = roleLower.includes('nurse') || roleLower.includes('nursing');
  // Allow: dev superadmin, charge console, primary nurse match,
  // or any nurse role when no primary nurse has been assigned yet
  if (!dev && !charge && primaryNurseId !== String(userId || '') && !(userIsNurse && !primaryNurseId)) {
    return NextResponse.json(
      { error: 'Forbidden: only primary nurse or charge roles can record vitals' },
      { status: 403 }
    );
  }

  const missing: string[] = [];
  const invalid: string[] = [];

  const systolic = toNumberOrNull(body.systolic);
  const diastolic = toNumberOrNull(body.diastolic);
  const hr = toNumberOrNull(body.hr);
  const rr = toNumberOrNull(body.rr);
  const temp = toNumberOrNull(body.temp);
  const spo2 = toNumberOrNull(body.spo2);
  const painScore = toNumberOrNull(body.painScore);
  const avpu = normalizeAvpu(body.avpu);

  if (body.systolic === '' || body.systolic == null) missing.push('systolic');
  if (body.diastolic === '' || body.diastolic == null) missing.push('diastolic');
  if (body.hr === '' || body.hr == null) missing.push('hr');
  if (body.rr === '' || body.rr == null) missing.push('rr');
  if (body.temp === '' || body.temp == null) missing.push('temp');
  if (body.spo2 === '' || body.spo2 == null) missing.push('spo2');
  if (body.painScore === '' || body.painScore == null) missing.push('painScore');
  if (body.avpu === '' || body.avpu == null) missing.push('avpu');

  if (body.systolic != null && body.systolic !== '' && systolic == null) invalid.push('systolic');
  if (body.diastolic != null && body.diastolic !== '' && diastolic == null) invalid.push('diastolic');
  if (body.hr != null && body.hr !== '' && hr == null) invalid.push('hr');
  if (body.rr != null && body.rr !== '' && rr == null) invalid.push('rr');
  if (body.temp != null && body.temp !== '' && temp == null) invalid.push('temp');
  if (body.spo2 != null && body.spo2 !== '' && spo2 == null) invalid.push('spo2');
  if (body.painScore != null && body.painScore !== '' && painScore == null) invalid.push('painScore');
  if (body.avpu != null && body.avpu !== '' && avpu == null) invalid.push('avpu');

  if (painScore != null && (painScore < 0 || painScore > 10)) invalid.push('painScore');

  if (missing.length || invalid.length) {
    return NextResponse.json(
      { error: 'Validation failed', missing, invalid },
      { status: 400 }
    );
  }

  const now = new Date();
  const evalResult = evaluateCriticalVitals({
    systolic,
    diastolic,
    hr,
    rr,
    temp,
    spo2,
    painScore,
    avpu,
  });

  const doc = await prisma.ipdVitals.create({
    data: {
      tenantId,
      episodeId,
      recordedAt: now,
      recordedByUserId: userId,
      vitals: {
        systolic,
        diastolic,
        hr,
        rr,
        temp,
        spo2,
      },
      painScore,
      avpu,
      critical: evalResult.critical,
      criticalReasons: evalResult.reasons,
      createdAt: now,
    },
  });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'ipd_vitals',
    entityId: doc.id,
    action: 'CREATE',
    after: {
      episodeId,
      recordedAt: doc.recordedAt,
      vitals: doc.vitals,
      painScore,
      avpu,
      critical: doc.critical,
      criticalReasons: doc.criticalReasons,
    },
    ip,
  });

  return NextResponse.json({ success: true, vitals: doc });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
