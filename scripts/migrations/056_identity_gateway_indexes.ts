import { MongoClient } from 'mongodb';

async function safeDropIndex(collection: any, name: string) {
  try {
    await collection.dropIndex(name);
  } catch (error: any) {
    if (String(error?.code || '') !== '27' && !String(error?.message || '').includes('index not found')) {
      throw error;
    }
  }
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  const tenantId = process.env.ER_TENANT_ID || process.env.TENANT_ID;
  if (!uri) throw new Error('Missing MONGODB_URI/MONGO_URL');
  if (!tenantId) throw new Error('Missing ER_TENANT_ID/TENANT_ID');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const identityLookups = db.collection('identity_lookups');
  const applyIdempotency = db.collection('identity_apply_idempotency');
  const rateLimits = db.collection('identity_rate_limits');

  await safeDropIndex(identityLookups, 'tenantId_1_requestId_1');
  await identityLookups.createIndex({ tenantId: 1, userId: 1, clientRequestId: 1 }, {
    unique: true,
    partialFilterExpression: { clientRequestId: { $type: 'string' } },
  });
  await identityLookups.createIndex({ tenantId: 1, dedupeKey: 1, createdAt: -1 });

  await safeDropIndex(applyIdempotency, 'tenantId_1_requestId_1');
  await applyIdempotency.createIndex({ tenantId: 1, userId: 1, requestId: 1 }, { unique: true });

  await rateLimits.createIndex({ tenantId: 1, userId: 1 }, { unique: true });
  await rateLimits.createIndex({ tenantId: 1, updatedAt: -1 });

  await client.close();
  console.log(`✅ Identity gateway indexes ensured for tenant ${tenantId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
