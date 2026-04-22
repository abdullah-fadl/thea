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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type OrderKind = 'LAB' | 'IMAGING' | 'NURSING';
const ORDER_KINDS: OrderKind[] = ['LAB', 'IMAGING', 'NURSING'];

const bodySchema = z.object({
  kind: z.enum(['LAB', 'IMAGING', 'NURSING']),
  title: z.string().min(1, 'title is required'),
  notes: z.string().optional(),
}).passthrough();

function isDoctor(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return r.includes('doctor') || r.includes('physician');
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user }, params) => {

  const role = String(user?.role || '');
  if (!isDoctor(role) && !role.toLowerCase().includes('nurse')) {
    if (!canAccessChargeConsole({ email: user?.email, tenantId, role })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const routeParams = (params || {}) as any;
  const episodeId = String(routeParams.episodeId || '').trim();
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
  }

  const items = await prisma.ipdOrder.findMany({
    where: { tenantId, episodeId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({ items });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }, params) => {

  const role = String(user?.role || '');
  const dev = false;
  if (!dev && !isDoctor(role)) {
    return NextResponse.json({ error: 'Forbidden: only doctors can create orders' }, { status: 403 });
  }

  const routeParams = (params || {}) as any;
  const episodeId = String(routeParams.episodeId || '').trim();
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

  const kind = v.data.kind;
  const title = String(v.data.title).trim();
  const notes = String(v.data.notes || '').trim();

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }
  const encounterCoreId = String(episode.encounterId || '').trim();
  if (encounterCoreId) {
    const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
    if (deathGuard) return deathGuard;
  }

  const now = new Date();
  const order = await prisma.ipdOrder.create({
    data: {
      tenantId,
      episodeId,
      encounterId: String(episode.encounterId || ''),
      kind,
      title,
      notes: notes || null,
      status: 'DRAFT',
      createdAt: now,
      createdByUserId: userId,
      updatedAt: now,
      updatedByUserId: userId,
    },
  });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'ipd_order',
    entityId: order.id,
    action: 'CREATE',
    after: order,
    ip,
  });

  return NextResponse.json({ success: true, order });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
