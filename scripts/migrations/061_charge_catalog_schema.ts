import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.BILLING_TENANT_ID || process.env.TENANT_ID || 'test';

const COUNTER_COLLECTION = 'charge_catalog_counters';

const ITEM_TYPE_PREFIX: Record<string, { prefix: string; pad: number }> = {
  VISIT: { prefix: 'VIS', pad: 4 },
  LAB_TEST: { prefix: 'LAB', pad: 4 },
  IMAGING: { prefix: 'IMG', pad: 4 },
  PROCEDURE: { prefix: 'PRC', pad: 4 },
  MEDICATION: { prefix: 'MED', pad: 4 },
  BED: { prefix: 'BED', pad: 4 },
  SUPPLY: { prefix: 'SUP', pad: 4 },
  SERVICE: { prefix: 'SRV', pad: 4 },
};

const DEPARTMENTS = new Set(['OPD', 'LAB', 'RAD', 'IPD', 'OR', 'ICU', 'OTHER']);
const APPLICABILITY = ['ER', 'OPD', 'IPD', 'ICU', 'OR'];

function normalizeDepartment(value: unknown) {
  const dep = String(value || '').trim().toUpperCase();
  return dep && DEPARTMENTS.has(dep) ? dep : '';
}

function inferItemType(args: { departmentDomain: string; unitType: string }) {
  const { departmentDomain, unitType } = args;
  if (departmentDomain === 'LAB') return 'LAB_TEST';
  if (departmentDomain === 'RAD') return 'IMAGING';
  if (departmentDomain === 'OR') return 'PROCEDURE';
  if (unitType === 'PER_DAY') return 'BED';
  if (unitType === 'PER_VISIT') return 'VISIT';
  if (unitType === 'PER_TEST') return 'LAB_TEST';
  if (unitType === 'PER_PROCEDURE') return 'PROCEDURE';
  if (unitType === 'PER_DOSE') return 'MEDICATION';
  return 'SERVICE';
}

function inferApplicability(departmentDomain: string) {
  if (departmentDomain && APPLICABILITY.includes(departmentDomain)) return [departmentDomain];
  return APPLICABILITY;
}

function parseSeq(value: string, prefix: string): number | null {
  const match = new RegExp(`^${prefix}-(\\d+)$`, 'i').exec(value);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Charge Catalog Schema Migration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const catalog = db.collection('charge_catalog');

  await db.collection(COUNTER_COLLECTION).createIndex({ tenantId: 1, itemType: 1 }, { unique: true });
  await catalog.createIndex({ tenantId: 1, code: 1 }, { unique: true });
  await catalog.createIndex({ tenantId: 1, status: 1 });
  await catalog.createIndex({ tenantId: 1, itemType: 1 });

  const cursor = catalog.find({ tenantId: TENANT_ID }, { projection: { _id: 0 } });
  const maxByType: Record<string, number> = {};
  let updated = 0;

  for await (const doc of cursor) {
    const unitType = String(doc.unitType || '').trim().toUpperCase();
    const departmentDomain = normalizeDepartment(doc.departmentDomain || doc.department || '');
    const nextItemType = doc.itemType
      ? String(doc.itemType || '').trim().toUpperCase()
      : doc.type
        ? String(doc.type || '').trim().toUpperCase()
        : inferItemType({ departmentDomain, unitType });
    const nextApplicability = Array.isArray(doc.applicability) && doc.applicability.length
      ? doc.applicability.map((v: any) => String(v || '').trim().toUpperCase()).filter(Boolean)
      : inferApplicability(departmentDomain);

    const patch: Record<string, any> = {};
    if (!doc.departmentDomain && departmentDomain) patch.departmentDomain = departmentDomain;
    if (!doc.itemType && nextItemType) patch.itemType = nextItemType;
    if (!doc.applicability || !Array.isArray(doc.applicability) || !doc.applicability.length) {
      patch.applicability = nextApplicability;
    }
    if (!Array.isArray(doc.flags)) {
      patch.flags = [];
    }
    if (Object.keys(patch).length) {
      await catalog.updateOne({ tenantId: TENANT_ID, id: doc.id }, { $set: patch });
      updated += 1;
    }

    const itemType = doc.itemType
      ? String(doc.itemType || '').trim().toUpperCase()
      : doc.type
        ? String(doc.type || '').trim().toUpperCase()
        : nextItemType;
    const prefix = ITEM_TYPE_PREFIX[itemType]?.prefix;
    if (prefix && typeof doc.code === 'string') {
      const seq = parseSeq(doc.code.trim().toUpperCase(), prefix);
      if (seq) {
        maxByType[itemType] = Math.max(maxByType[itemType] || 0, seq);
      }
    }
  }

  for (const itemType of Object.keys(ITEM_TYPE_PREFIX)) {
    const seq = maxByType[itemType] || 0;
    await db.collection(COUNTER_COLLECTION).updateOne(
      { tenantId: TENANT_ID, itemType },
      { $set: { seq } },
      { upsert: true }
    );
  }

  console.log(`✅ charge_catalog updated: ${updated} record(s)`);
  console.log('✅ charge_catalog counters ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Charge catalog schema migration failed:', error);
  process.exit(1);
});
