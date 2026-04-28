import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { mergeContextPack } from '@/lib/sam/tenantContext';
import { logger } from '@/lib/monitoring/logger';
import type { TenantContextOverlay, TenantContextPack } from '@/lib/models/TenantContext';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(async (req, { tenantId }) => {
  try {
    const basePacks = await prisma.tenantContextPack.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    const basePack = basePacks[0] as unknown as TenantContextPack | undefined;

    if (!basePack) {
      return NextResponse.json({ error: 'Context pack not found' }, { status: 404 });
    }

    const overlays = (await prisma.tenantContextOverlay.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    })) as unknown as TenantContextOverlay[];

    const merged = mergeContextPack(basePack, overlays);

    return NextResponse.json({
      base: basePack,
      overlays,
      merged,
    });
  } catch (error: any) {
    logger.error('Context pack fetch error', { category: 'api', error });
    // [SEC-06]
    return NextResponse.json(
      { error: 'Failed to load context pack' },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true });
