import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { resolveTenantUser, normalizeRoles } from '@/lib/access/tenantUser';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseLimit(value: string | null): number {
  const n = Number(value ?? 500);
  if (!Number.isFinite(n)) return 500;
  return Math.max(1, Math.min(2000, Math.floor(n)));
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    // Admin/dev only (tenant_users RBAC).
    const resolved = await resolveTenantUser({ tenantId, userId, user });
    if (resolved instanceof NextResponse) return resolved;
    const roles = normalizeRoles(resolved.tenantUser?.roles || []);
    const isAdminDev = roles.includes('admin') || roles.includes('dev');
    if (!isAdminDev) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const from = parseDate(url.searchParams.get('from'));
    const to = parseDate(url.searchParams.get('to'));
    const resourceTypeFilter = String(url.searchParams.get('entityType') || '').trim();
    const action = String(url.searchParams.get('action') || '').trim();
    const userIdFilter = String(url.searchParams.get('userId') || url.searchParams.get('actor') || '').trim();
    const cursor = String(url.searchParams.get('cursor') || '').trim();
    const limit = parseLimit(url.searchParams.get('limit'));

    if (url.searchParams.get('from') && !from) {
      return NextResponse.json({ error: 'Invalid from (expected ISO date)' }, { status: 400 });
    }
    if (url.searchParams.get('to') && !to) {
      return NextResponse.json({ error: 'Invalid to (expected ISO date)' }, { status: 400 });
    }
    if (from && to && from > to) {
      return NextResponse.json({ error: 'Invalid date range (from is after to)' }, { status: 400 });
    }

    const where: Record<string, unknown> = { tenantId };
    if (resourceTypeFilter) where.resourceType = resourceTypeFilter;
    if (action) where.action = action;
    if (userIdFilter) where.actorUserId = userIdFilter;
    if (from || to) {
      where.timestamp = {} as any;
      if (from) (where.timestamp as any).gte = from;
      if (to) (where.timestamp as any).lte = to;
    }

    // Cursor pagination: stable order by (timestamp asc, id asc).
    if (cursor) {
      const cursorDoc = await prisma.auditLog.findFirst({
        where: { tenantId, id: cursor },
        select: { id: true, timestamp: true },
      });
      if (!cursorDoc?.timestamp) {
        return NextResponse.json({ error: 'Invalid cursor (not found)' }, { status: 400 });
      }
      where.OR = [
        { timestamp: { gt: cursorDoc.timestamp } },
        { timestamp: cursorDoc.timestamp, id: { gt: cursor } },
      ];
    }

    const items = await prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        tenantId: true,
        actorUserId: true,
        resourceType: true,
        resourceId: true,
        action: true,
        metadata: true,
        ip: true,
        timestamp: true,
      },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
      take: limit,
    });

    const rows = items.map((it) => ({
      id: it.id,
      tenantId: String(it.tenantId || tenantId),
      userId: it.actorUserId,
      entityType: it.resourceType,
      entityId: it.resourceId,
      action: it.action,
      metadata: it.metadata,
      ip: it.ip,
      createdAt: it.timestamp ? new Date(it.timestamp).toISOString() : null,
    }));

    const nextCursor = rows.length ? rows[rows.length - 1].id : null;

    // CSV export support — ?format=csv
    const format = String(url.searchParams.get('format') || '').toLowerCase();
    if (format === 'csv') {
      const csvHeaders = ['id', 'tenantId', 'userId', 'entityType', 'entityId', 'action', 'ip', 'createdAt'];
      const escapeCsvField = (val: unknown): string => {
        const str = val == null ? '' : String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      const csvLines = [csvHeaders.join(',')];
      for (const row of rows) {
        csvLines.push(csvHeaders.map((h) => escapeCsvField((row as Record<string, unknown>)[h])).join(','));
      }
      const csvBody = csvLines.join('\n');
      return new NextResponse(csvBody, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-export-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      tenantId,
      rows,
      nextCursor,
      limit,
      count: rows.length,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health' }
);

