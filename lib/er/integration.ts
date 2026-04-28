import { prisma } from '@/lib/db/prisma';
import { randomUUID } from 'crypto';

export interface ErIntegrationSettings {
  id: string;
  tenantId: string;
  samEnabled: boolean;
  samSecret?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Retrieve (or lazily create) the ER integration settings for a tenant.
 *
 * Known limitation: There is no dedicated ErIntegrationSettings Prisma model.
 * Settings are stored in the SystemSetting key-value table (key = "er_integration_{tenantId}")
 * with the full settings object serialized as JSON in the `value` column. This is adequate
 * for low-frequency reads but lacks typed column constraints. To upgrade, define an
 * ErIntegrationSettings model in prisma/schema/er.prisma and migrate existing rows.
 *
 * The `_db` parameter is retained for call-site compatibility but is ignored.
 */
export async function getErIntegrationSettings(
  _db: any,
  tenantId: string
): Promise<ErIntegrationSettings> {
  const settingKey = `er_integration_${tenantId}`;

  const existing = await prisma.systemSetting.findUnique({
    where: { key: settingKey },
  });

  if (existing && existing.value) {
    const val = existing.value as Record<string, any>;
    return {
      id: val.id ?? existing.key,
      tenantId: val.tenantId ?? tenantId,
      samEnabled: val.samEnabled ?? false,
      samSecret: val.samSecret ?? null,
      createdAt: val.createdAt ? new Date(val.createdAt) : existing.updatedAt,
      updatedAt: existing.updatedAt,
    };
  }

  const now = new Date();
  const defaultSettings: ErIntegrationSettings = {
    id: randomUUID(),
    tenantId,
    samEnabled: false,
    samSecret: null,
    createdAt: now,
    updatedAt: now,
  };

  await prisma.systemSetting.create({
    data: {
      key: settingKey,
      value: defaultSettings as unknown as Parameters<typeof prisma.systemSetting.create>[0]['data']['value'],
    },
  });

  return defaultSettings;
}
