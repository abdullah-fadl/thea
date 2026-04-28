import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const itemId = ((params as Record<string, string>).proxyId || Object.values(params)[0]) as string;
      const item = await prisma.portalProxyAccess.findFirst({
        where: { tenantId, id: itemId },
      });
      if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[PORTALPROXYACCESS GET-DETAIL] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
  },
  { permissionKey: 'portal.proxy-access.view' }
);

export const PATCH = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const itemId = ((params as Record<string, string>).proxyId || Object.values(params)[0]) as string;
      const body = await req.json();
      // Explicit field picking to prevent mass assignment
      const allowedFields: Record<string, unknown> = {};
      if (body.status !== undefined) allowedFields.status = body.status;
      if (body.scope !== undefined) allowedFields.scope = body.scope;
      if (body.expiresAt !== undefined) allowedFields.expiresAt = body.expiresAt;
      if (body.notes !== undefined) allowedFields.notes = body.notes;
      if (Object.keys(allowedFields).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
      }
      const item = await prisma.portalProxyAccess.update({
        where: { id: itemId, tenantId },
        data: allowedFields,
      });
      return NextResponse.json({ item });
    } catch (e) {
      logger.error('[PORTALPROXYACCESS PATCH] Failed', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
  },
  { permissionKey: 'portal.proxy-access.edit' }
);
