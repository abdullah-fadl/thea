import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { resolveTenantUser, normalizeRoles } from '@/lib/access/tenantUser';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('Database ping timed out')), ms);
    promise
      .then((v) => {
        clearTimeout(id);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(id);
        reject(e);
      });
  });
}

export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId, userId, user }) => {
    // admin/dev only (tenant_users RBAC)
    const resolved = await resolveTenantUser({ tenantId, userId, user });
    if (resolved instanceof NextResponse) return resolved;
    const roles = normalizeRoles(resolved.tenantUser?.roles || []);
    const isAdminDev = roles.includes('admin') || roles.includes('dev');
    if (!isAdminDev) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
      await withTimeout(prisma.$queryRaw`SELECT 1`, 2000);
      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Database unreachable';
      logger.warn('health.db.failed', { reason: message });
      return NextResponse.json(
        { ok: false, error: message },
        { status: 503 }
      );
    }
  },
  { tenantScoped: true, platformKey: 'thea_health' }
);

