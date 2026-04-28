import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { writeErAuditLog } from '@/lib/er/audit';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  allergies: z.union([z.array(z.string()), z.string()]).optional(),
}).passthrough();

function isNurse(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r.includes('nurse') || r.includes('nursing');
}

function isDoctor(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r.includes('doctor') || r.includes('physician');
}

function cleanList(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((v) => String(v || '').trim()).filter(Boolean);
  }
  const text = String(input || '').trim();
  if (!text) return [];
  return text
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }, params) => {

  const role = String((user as unknown as { role?: string })?.role || '');
  const dev = false;
  const charge = canAccessChargeConsole({ email: user?.email, tenantId, role });
  if (!dev && !charge && !isNurse(role) && !isDoctor(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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

  const allergies = cleanList(v.data.allergies);

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }

  const riskFlags = (episode.riskFlags as Record<string, unknown>) || {};
  const before = Array.isArray(riskFlags.allergies) ? riskFlags.allergies : [];
  const same =
    before.length === allergies.length &&
    before.every((v: string, idx: number) => String(v).trim() === String(allergies[idx] || '').trim());
  if (same) {
    return NextResponse.json({ success: true, noOp: true, allergies: before });
  }

  const now = new Date();
  // IpdEpisode doesn't have a dedicated allergies field; store in riskFlags Json
  const currentRiskFlags = (episode.riskFlags as Record<string, unknown>) || {};
  await prisma.ipdEpisode.update({
    where: { id: episodeId },
    data: {
      riskFlags: { ...currentRiskFlags, allergies } as Parameters<typeof prisma.ipdEpisode.update>[0]['data']['riskFlags'],
      updatedAt: now,
      updatedByUserId: userId,
    },
  });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'ipd_episode',
    entityId: episodeId,
    action: 'SET_ALLERGIES',
    before,
    after: allergies,
    ip,
  });

  return NextResponse.json({ success: true, allergies });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
