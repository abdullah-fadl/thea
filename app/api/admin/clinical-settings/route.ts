import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';

export const GET = withAuthTenant(async (req: NextRequest, { tenantId }) => {
  const doc = await prisma.tenantSetting.findUnique({
    where: { tenantId_key: { tenantId, key: 'clinical_settings' } },
    select: { settings: true },
  });

  return NextResponse.json({ settings: doc?.settings || null });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'admin.data-admin.view' });

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId }) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { validateBody } = await import('@/lib/validation/helpers');
  const { clinicalSettingsSchema } = await import('@/lib/validation/admin.schema');
  const v = validateBody(body, clinicalSettingsSchema);
  if ('error' in v) return v.error;

  await prisma.tenantSetting.upsert({
    where: { tenantId_key: { tenantId, key: 'clinical_settings' } },
    update: {
      settings: v.data.settings as Prisma.InputJsonValue,
      updatedByUserId: userId || null,
    },
    create: {
      tenantId,
      key: 'clinical_settings',
      settings: v.data.settings as Prisma.InputJsonValue,
      updatedByUserId: userId || null,
    },
  });

  await createAuditLog(
    'tenant_setting',
    'clinical_settings',
    'CLINICAL_SETTINGS_UPDATED',
    userId || 'system',
    undefined,
    { key: 'clinical_settings' },
    tenantId
  );

  return NextResponse.json({ success: true });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'admin.data-admin.edit' });
