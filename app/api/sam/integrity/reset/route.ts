import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditContext, logAuditEvent } from '@/lib/security/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const resetSchema = z.object({
  mode: z.enum(['archive', 'delete']).default('archive'),
  reason: z.string().optional(),
});

const isAllowedRole = (role: string) => role === 'admin' || role === 'thea-owner';

export const POST = withAuthTenant(
  async (req, { tenantId, user, userId, role }) => {
  // Guardrails: admin + dev-only by default
  const resetEnabled =
    process.env.NODE_ENV === 'development' || process.env.SAM_ENABLE_TENANT_RESET === 'true';

  if (!resetEnabled) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Tenant integrity reset is disabled.' },
      { status: 403 }
    );
  }
  if (!isAllowedRole(role)) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Admin role required.' },
      { status: 403 }
    );
  }

  const body = resetSchema.parse(await req.json().catch(() => ({})));
  const mode = body.mode;
  const reason = (body.reason || 'tenant_reset').trim();

  const auditContext = createAuditContext(
    {
      userId,
      userRole: role,
      userEmail: user?.email,
      tenantId,
    },
    {
      ip: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
      method: req.method,
      path: req.nextUrl.pathname,
    }
  );

  const now = new Date();

  if (mode === 'delete') {
    const findingsRes = await prisma.integrityFinding.deleteMany({ where: { tenantId } });
    const runsRes = await prisma.integrityRun.deleteMany({ where: { tenantId } });

    await logAuditEvent(auditContext, 'integrity_reset', 'system', {
      resourceId: tenantId,
      metadata: {
        mode,
        reason,
        deleted: {
          integrity_findings: findingsRes.count || 0,
          integrity_runs: runsRes.count || 0,
        },
      },
    });

    return NextResponse.json({
      success: true,
      mode,
      deleted: {
        integrity_findings: findingsRes.count || 0,
        integrity_runs: runsRes.count || 0,
      },
    });
  }

  // archive
  const findingsRes = await prisma.integrityFinding.updateMany({
    where: { tenantId, archivedAt: null },
    data: { archivedAt: now, updatedAt: now } as any,
  });
  const runsRes = await prisma.integrityRun.updateMany({
    where: { tenantId, cancelledAt: null },
    data: { cancelledAt: now, updatedAt: now } as any,
  });

  await logAuditEvent(auditContext, 'integrity_reset', 'system', {
    resourceId: tenantId,
    metadata: {
      mode,
      reason,
      archived: {
        integrity_findings: findingsRes.count || 0,
        integrity_runs: runsRes.count || 0,
      },
    },
  });

  return NextResponse.json({
    success: true,
    mode,
    archived: {
      integrity_findings: findingsRes.count || 0,
      integrity_runs: runsRes.count || 0,
    },
  });
  },
  { platformKey: 'sam', tenantScoped: true }
);
