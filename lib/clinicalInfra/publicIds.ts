import { prisma } from '@/lib/db/prisma';

export const PUBLIC_ID_COLLECTION = 'public_id_counters';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tenantKeyCache = new Map<string, string>();

async function resolveTenantUuid(value: string): Promise<string> {
  if (UUID_RE.test(value)) return value;
  const cached = tenantKeyCache.get(value);
  if (cached) return cached;
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { tenantId: value },
      select: { id: true },
    });
    if (tenant?.id) {
      tenantKeyCache.set(value, tenant.id);
      return tenant.id;
    }
  } catch {
    /* ignore */
  }
  return value;
}

const SHORT_CODE_CONFIG: Record<string, { prefix: string; pad: number }> = {
  clinical_infra_facility: { prefix: 'FAC', pad: 4 },
  clinical_infra_unit: { prefix: 'UNT', pad: 4 },
  clinical_infra_floor: { prefix: 'FLR', pad: 4 },
  clinical_infra_room: { prefix: 'RM', pad: 4 },
  clinical_infra_bed: { prefix: 'BED', pad: 4 },
  clinical_infra_clinic: { prefix: 'CLN', pad: 4 },
  clinical_infra_specialty: { prefix: 'SPC', pad: 4 },
  clinical_infra_provider: { prefix: 'PRV', pad: 4 },
};

const zeroPad = (value: number, length: number) => String(value).padStart(length, '0');

export async function allocateShortCode(args: {
  db?: any; // optional Prisma transaction client; falls back to global prisma
  tenantId: string;
  entityType: string;
  prefix?: string;
  pad?: number;
}) {
  const config = SHORT_CODE_CONFIG[args.entityType];
  const prefix = args.prefix || config?.prefix;
  const pad = args.pad || config?.pad || 4;
  if (!prefix) {
    return null;
  }

  const client = args.db || prisma;
  const tenantUuid = await resolveTenantUuid(args.tenantId);
  const rows: { seq: number }[] = await client.$queryRaw`
    INSERT INTO public_id_counters ("tenantId", "entityType", seq)
    VALUES (${tenantUuid}, ${args.entityType}, 1)
    ON CONFLICT ("tenantId", "entityType")
    DO UPDATE SET seq = public_id_counters.seq + 1
    RETURNING seq
  `;

  const seq = Number(rows[0]?.seq || 1);
  return `${prefix}-${zeroPad(seq, pad)}`;
}
