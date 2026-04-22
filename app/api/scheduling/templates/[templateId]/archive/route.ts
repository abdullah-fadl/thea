import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canManageScheduling } from '@/lib/scheduling/access';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  if (!canManageScheduling({ user, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const templateId = String((params as any)?.templateId || '').trim();
  if (!templateId) {
    return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
  }

  const existing = await prisma.schedulingTemplate.findFirst({
    where: { tenantId, id: templateId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }
  if (existing.status === 'ARCHIVED') {
    return NextResponse.json({ success: true, noOp: true, template: existing });
  }

  const template = await prisma.schedulingTemplate.update({
    where: { id: templateId },
    data: { status: 'ARCHIVED' },
  });

  await createAuditLog(
    'scheduling_template',
    templateId,
    'ARCHIVE',
    userId || 'system',
    user?.email,
    { before: existing, after: template },
    tenantId
  );

  return NextResponse.json({ template });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.edit' }
);
