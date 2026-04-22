import { MongoClient } from 'mongodb';

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  const tenantId = process.env.ER_TENANT_ID || process.env.TENANT_ID;
  if (!uri) throw new Error('Missing MONGODB_URI/MONGO_URL');
  if (!tenantId) throw new Error('Missing ER_TENANT_ID/TENANT_ID');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const resources = db.collection('scheduling_resources');
  const templates = db.collection('scheduling_templates');
  const overrides = db.collection('scheduling_availability_overrides');
  const slots = db.collection('scheduling_slots');
  const reservations = db.collection('scheduling_reservations');
  const idempotency = db.collection('scheduling_idempotency');

  await resources.createIndex({ tenantId: 1, resourceType: 1, departmentKey: 1 });
  await resources.createIndex({ tenantId: 1, displayName: 1 });
  await resources.createIndex({ tenantId: 1, resourceType: 1, departmentKey: 1, displayName: 1 }, { unique: true });

  await templates.createIndex({ tenantId: 1, resourceId: 1 });
  await templates.createIndex(
    { tenantId: 1, resourceId: 1, rrule: 1, startTime: 1, endTime: 1, slotMinutes: 1, effectiveFrom: 1 },
    { unique: true }
  );

  await overrides.createIndex({ tenantId: 1, resourceId: 1, date: 1 }, { unique: true });

  await slots.createIndex({ tenantId: 1, resourceId: 1, date: 1 });
  await slots.createIndex({ tenantId: 1, generationKey: 1 }, { unique: true });

  await reservations.createIndex({ tenantId: 1, idempotencyKey: 1 }, { unique: true });
  await reservations.createIndex(
    { tenantId: 1, slotId: 1 },
    { unique: true, partialFilterExpression: { status: 'ACTIVE' } }
  );
  await reservations.createIndex({ tenantId: 1, resourceId: 1, createdAt: 1 });

  // Optional request replay (admin/dev writes)
  await idempotency.createIndex({ tenantId: 1, key: 1, method: 1, pathname: 1 }, { unique: true });
  await idempotency.createIndex({ tenantId: 1, createdAt: 1 });

  await client.close();
  console.log(`✅ Scheduling core indexes ensured for tenant ${tenantId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
