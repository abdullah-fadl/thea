import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';
export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const item = await (prisma as Record<string, any>).brainDeathProtocol.findFirst({
        where: { tenantId, episodeId: params.episodeId },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[BRAIN-DEATH GET] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
  },
  { permissionKey: 'icu.brain-death.view' }
);

export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }, params: any) => {
    try {
      const body = await req.json();
      const item = await (prisma as Record<string, any>).brainDeathProtocol.create({
        data: { tenantId, episodeId: params.episodeId, ...body, createdByUserId: userId },
      });
      return NextResponse.json({ item }, { status: 201 });
    } catch (e) {
      logger.error('[BRAIN-DEATH POST] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
  },
  { permissionKey: 'icu.brain-death.edit' }
);

export const PATCH = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const body = await req.json();
      const existing = await (prisma as Record<string, any>).brainDeathProtocol.findFirst({
        where: { tenantId, episodeId: params.episodeId },
        orderBy: { createdAt: 'desc' },
      });
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const item = await (prisma as Record<string, any>).brainDeathProtocol.update({
        where: { id: existing.id },
        data: body,
      });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[BRAIN-DEATH PATCH] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
  },
  { permissionKey: 'icu.brain-death.edit' }
);
