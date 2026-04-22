import { getTenantDbByKey } from '../../lib/db/tenantDb';
import type { Db } from 'mongodb';

const TENANT_ID = process.env.TENANT_ID || 'test';
const SEQUENCE_COLLECTION = 'er_sequences';
const ENCOUNTER_COLLECTION = 'encounters';

function padSequence(value: number, width = 5): string {
  const raw = String(value);
  return raw.length >= width ? raw : raw.padStart(width, '0');
}

async function allocateErVisitNumber(db: Db): Promise<string> {
  const sequences = db.collection(SEQUENCE_COLLECTION);
  const key = `er_visit_${TENANT_ID}`;
  const result = await sequences.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const doc = (result as Record<string, unknown>)?.value ?? (result as Record<string, unknown>);
  const nextValue = typeof doc?.value === 'number' ? doc.value : 1;
  return `ER-${padSequence(nextValue, 5)}`;
}

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ER Visit Number Migration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const encounters = db.collection(ENCOUNTER_COLLECTION);
  const cursor = encounters.find(
    {
      tenantId: TENANT_ID,
      $or: [{ visitNumber: { $exists: false } }, { visitNumber: null }, { visitNumber: '' }],
    },
    { projection: { _id: 0, id: 1 } }
  );

  let backfilled = 0;
  while (await cursor.hasNext()) {
    const item = await cursor.next();
    if (!item?.id) continue;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const visitNumber = await allocateErVisitNumber(db);
      const res = await encounters.updateOne(
        {
          tenantId: TENANT_ID,
          id: item.id,
          $or: [{ visitNumber: { $exists: false } }, { visitNumber: null }, { visitNumber: '' }],
        },
        { $set: { visitNumber } }
      );
      if (res.matchedCount > 0) {
        backfilled += 1;
        break;
      }
      const existing = await encounters.findOne(
        { tenantId: TENANT_ID, id: item.id },
        { projection: { _id: 0, visitNumber: 1 } }
      );
      if (existing?.visitNumber) break;
    }
  }

  console.log(`✅ Backfilled visitNumber for ${backfilled} encounters`);
  await encounters.createIndex({ tenantId: 1, visitNumber: 1 }, { unique: true });
  console.log('✅ Unique index ensured: encounters(tenantId, visitNumber)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ ER visit number migration failed:', error);
  process.exit(1);
});
