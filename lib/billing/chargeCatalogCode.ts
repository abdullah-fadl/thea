import { prisma } from '@/lib/db/prisma';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tenantKeyCache = new Map<string, string>();

async function resolveTenantUuid(value: string): Promise<string> {
  if (UUID_RE.test(value)) return value;
  const cached = tenantKeyCache.get(value);
  if (cached) return cached;
  try {
    const tenant = await prisma.tenant.findFirst({ where: { tenantId: value }, select: { id: true } });
    if (tenant?.id) {
      tenantKeyCache.set(value, tenant.id);
      return tenant.id;
    }
  } catch {
    /* ignore */
  }
  return value;
}

const TYPE_PREFIX: Record<string, { prefix: string; pad: number }> = {
  VISIT: { prefix: 'VIS', pad: 4 },
  LAB_TEST: { prefix: 'LAB', pad: 4 },
  IMAGING: { prefix: 'IMG', pad: 4 },
  PROCEDURE: { prefix: 'PRC', pad: 4 },
  MEDICATION: { prefix: 'MED', pad: 4 },
  BED: { prefix: 'BED', pad: 4 },
  SUPPLY: { prefix: 'SUP', pad: 4 },
  SERVICE: { prefix: 'SRV', pad: 4 },
};

const zeroPad = (value: number, length: number) => String(value).padStart(length, '0');

export function getChargeCodePrefix(itemType: string) {
  return TYPE_PREFIX[itemType];
}

export async function allocateChargeCatalogCode(args: { db?: any; tenantId: string; itemType: string }) {
  const config = TYPE_PREFIX[args.itemType];
  if (!config) return null;

  const tenantUuid = await resolveTenantUuid(args.tenantId);
  const rows: any[] = await prisma.$queryRawUnsafe(
    `INSERT INTO "charge_catalog_counters" ("tenantId", "itemType", "seq")
     VALUES ($1, $2, 1)
     ON CONFLICT ("tenantId", "itemType")
     DO UPDATE SET "seq" = "charge_catalog_counters"."seq" + 1
     RETURNING "seq"`,
    tenantUuid,
    args.itemType
  );
  const seq = Number(rows[0]?.seq || 1);
  return `${config.prefix}-${zeroPad(seq, config.pad)}`;
}
