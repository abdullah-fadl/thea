import { prisma } from '@/lib/db/prisma';

const zeroPad = (value: number, length: number) => String(value).padStart(length, '0');
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

export async function allocatePricingPackageCode(args: { db?: any; tenantId: string }) {
  const tenantUuid = await resolveTenantUuid(args.tenantId);
  const rows: any[] = await prisma.$queryRawUnsafe(
    `INSERT INTO "pricing_package_counters" ("tenantId", "seq")
     VALUES ($1, 1)
     ON CONFLICT ("tenantId")
     DO UPDATE SET "seq" = "pricing_package_counters"."seq" + 1
     RETURNING "seq"`,
    tenantUuid
  );
  const seq = Number(rows[0]?.seq || 1);
  return `PKG-${zeroPad(seq, 4)}`;
}
