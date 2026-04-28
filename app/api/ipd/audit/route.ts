import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET — list audit log entries for IPD (ipd_episode + ipd_order + ipd_admission)
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Number(sp.get('limit') || 100), 500);
    const offset = Math.max(Number(sp.get('offset') || 0), 0);
    const typeFilter = (sp.get('type') || '').trim();
    const from = sp.get('from');
    const to = sp.get('to');
    const search = (sp.get('q') || '').trim().toLowerCase();

    const where: any = {
      tenantId,
      resourceType: { in: ['ipd_episode', 'ipd_order', 'ipd_admission', 'ipd_vitals', 'ipd_admission_intake'] },
    };

    if (typeFilter) {
      where.resourceType = typeFilter;
    }

    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(from);
      if (to) where.timestamp.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Resolve user display names
    const userIds = new Set<string>();
    for (const log of logs) {
      if (log.actorUserId) userIds.add(String(log.actorUserId));
    }
    const users = userIds.size
      ? await prisma.user.findMany({
          where: { tenantId, id: { in: Array.from(userIds) } },
          select: { id: true, email: true, firstName: true, lastName: true },
        })
      : [];
    const userMap = new Map<string, string>();
    for (const u of users) {
      const name = `${(u.firstName || '').trim()} ${(u.lastName || '').trim()}`.trim();
      userMap.set(String(u.id), name || String(u.email || ''));
    }

    const items = logs.map((log: any) => ({
      id: log.id,
      timestamp: log.timestamp,
      action: log.action || 'UNKNOWN',
      resourceType: log.resourceType || '',
      resourceId: log.resourceId || '',
      actorUserId: log.actorUserId || '',
      actorDisplay: userMap.get(String(log.actorUserId || '')) || String(log.actorUserId || '') || '---',
      ip: log.ipAddress || log.ip || null,
      metadata: log.metadata || {},
    }));

    // Search filter
    const filtered = search
      ? items.filter(it =>
          it.actorDisplay.toLowerCase().includes(search) ||
          it.action.toLowerCase().includes(search) ||
          it.resourceId.toLowerCase().includes(search)
        )
      : items;

    return NextResponse.json({ items: filtered, total, limit, offset });
  }),
  { tenantScoped: true, permissionKey: 'ipd.admin.view' }
);
