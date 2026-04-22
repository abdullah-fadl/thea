import { getTenantDbByKey } from '../../lib/db/tenantDb';
import { PUBLIC_ID_COLLECTION } from '../../lib/clinicalInfra/publicIds';

const TENANT_ID = process.env.CLINICAL_INFRA_TENANT_ID || process.env.TENANT_ID || 'test';

type EntityConfig = {
  entityType: string;
  collection: string;
  prefix: string;
  pad: number;
};

const ENTITY_MAP: EntityConfig[] = [
  { entityType: 'clinical_infra_facility', collection: 'clinical_infra_facilities', prefix: 'FAC', pad: 4 },
  { entityType: 'clinical_infra_unit', collection: 'clinical_infra_units', prefix: 'UNT', pad: 4 },
  { entityType: 'clinical_infra_floor', collection: 'clinical_infra_floors', prefix: 'FLR', pad: 4 },
  { entityType: 'clinical_infra_room', collection: 'clinical_infra_rooms', prefix: 'RM', pad: 4 },
  { entityType: 'clinical_infra_bed', collection: 'clinical_infra_beds', prefix: 'BED', pad: 4 },
  { entityType: 'clinical_infra_clinic', collection: 'clinical_infra_clinics', prefix: 'CLN', pad: 4 },
  { entityType: 'clinical_infra_specialty', collection: 'clinical_infra_specialties', prefix: 'SPC', pad: 4 },
  { entityType: 'clinical_infra_provider', collection: 'clinical_infra_providers', prefix: 'PRV', pad: 4 },
];

const zeroPad = (value: number, length: number) => String(value).padStart(length, '0');

const normalizeCode = (value: unknown) => {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase();
};

const parseSeq = (value: string, prefix: string): number | null => {
  const match = new RegExp(`^${prefix}-(\\d+)$`, 'i').exec(value);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function fixEntity(
  db: ReturnType<typeof getTenantDbByKey> extends Promise<infer T> ? T : never,
  cfg: EntityConfig
) {
  const col = db.collection(cfg.collection);
  const docs = await col
    .find({ tenantId: TENANT_ID }, { projection: { _id: 0, id: 1, shortCode: 1, createdAt: 1 } })
    .sort({ createdAt: 1, id: 1 })
    .toArray();

  const counts = new Map<string, number>();
  let maxSeq = 0;
  for (const doc of docs) {
    const code = normalizeCode(doc.shortCode);
    if (!code) continue;
    counts.set(code, (counts.get(code) || 0) + 1);
    const seq = parseSeq(code, cfg.prefix);
    if (seq && seq > maxSeq) maxSeq = seq;
  }

  const counterDoc = await db
    .collection(PUBLIC_ID_COLLECTION)
    .findOne({ tenantId: TENANT_ID, entityType: cfg.entityType });
  const counterSeq = Number(counterDoc?.seq || 0);
  if (counterSeq > maxSeq) maxSeq = counterSeq;

  let nextSeq = maxSeq;
  let updated = 0;
  const seen = new Map<string, number>();

  for (const doc of docs) {
    const code = normalizeCode(doc.shortCode);
    const count = code ? counts.get(code) || 0 : 0;
    const seenCount = code ? (seen.get(code) || 0) + 1 : 0;
    if (code) seen.set(code, seenCount);

    const isValid = !!(code && parseSeq(code, cfg.prefix));
    const isDuplicate = code && count > 1 && seenCount > 1;
    const needsFix = !code || !isValid || isDuplicate;

    if (!needsFix) continue;

    nextSeq += 1;
    const newCode = `${cfg.prefix}-${zeroPad(nextSeq, cfg.pad)}`;
    await col.updateOne({ tenantId: TENANT_ID, id: doc.id }, { $set: { shortCode: newCode } });
    updated += 1;
  }

  await db.collection(PUBLIC_ID_COLLECTION).updateOne(
    { tenantId: TENANT_ID, entityType: cfg.entityType },
    { $set: { seq: nextSeq } },
    { upsert: true }
  );

  console.log(`✓ ${cfg.collection}: updated=${updated} counter=${nextSeq}`);
}

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Fix Clinical Infra Public IDs');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  for (const cfg of ENTITY_MAP) {
    await fixEntity(db, cfg);
  }

  console.log('✅ Public IDs fixed');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Fix failed:', error);
  process.exit(1);
});
