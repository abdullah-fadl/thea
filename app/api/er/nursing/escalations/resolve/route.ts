import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { writeErAuditLog } from '@/lib/er/audit';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { assertEncounterNotClosedByHandoff, ER_HANDOFF_CLOSED_ERROR } from '@/lib/er/handoff';
import { validateBody } from '@/lib/validation/helpers';
import { resolveEscalationSchema } from '@/lib/validation/er.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }) => {
  if (!canAccessChargeConsole({ email: user?.email, tenantId, role: (user as any)?.role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, resolveEscalationSchema);
  if ('error' in v) return v.error;
  const { escalationId } = v.data;

  const esc = await prisma.erEscalation.findFirst({ where: { tenantId, id: escalationId } });
  if (!esc) return NextResponse.json({ error: 'Escalation not found' }, { status: 404 });
  if (esc.status !== 'OPEN') {
    return NextResponse.json({ error: 'Escalation is not OPEN' }, { status: 400 });
  }
  try {
    await assertEncounterNotClosedByHandoff({ tenantId, encounterId: String((esc as Record<string, unknown>).encounterId || '') });
  } catch (err: any) {
    return NextResponse.json({ error: ER_HANDOFF_CLOSED_ERROR, handoffId: err?.handoffId || null }, { status: 409 });
  }

  const now = new Date();
  await prisma.erEscalation.update({
    where: { id: escalationId },
    data: { status: 'RESOLVED', resolvedAt: now, resolvedByUserId: userId } as Record<string, unknown>,
  });

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  await writeErAuditLog({
    tenantId,
    userId,
    entityType: 'escalation',
    entityId: escalationId,
    action: 'RESOLVE',
    before: { status: esc.status },
    after: { status: 'RESOLVED' },
    ip,
  });

  return NextResponse.json({ success: true });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.manage' }
);
