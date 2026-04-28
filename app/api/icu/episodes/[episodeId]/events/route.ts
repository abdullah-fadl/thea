import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_EVENT_TYPES = new Set([
  'ADMIT', 'TRANSFER', 'DISCHARGE',
  'SOFA_SCORE', 'VENTILATOR_CHECK', 'ASSESSMENT', 'NOTE',
]);

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {

  const routeParams = params || {};
  const episodeId = String((routeParams as Record<string, string>).episodeId || '').trim();
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
  }

  const items = await prisma.ipdIcuEvent.findMany({
    where: { tenantId, episodeId },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  return NextResponse.json({ items });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'icu.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {

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

  const type = String(body.type || '').trim().toUpperCase();
  if (!type || !VALID_EVENT_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid event type', valid: Array.from(VALID_EVENT_TYPES) }, { status: 400 });
  }

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }

  const note = body.data ? JSON.stringify(body.data) : (body.note || null);

  const event = await prisma.ipdIcuEvent.create({
    data: {
      tenantId,
      episodeId,
      type,
      note,
      source: body.source || null,
      destination: body.destination || null,
      createdByUserId: userId || null,
    },
  });

  return NextResponse.json({ success: true, event });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'icu.view' }
);
