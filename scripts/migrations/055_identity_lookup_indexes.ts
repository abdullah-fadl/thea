import { MongoClient } from 'mongodb';

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

  await identityLookups.createIndex({ tenantId: 1, createdAt: 1 });
  await identityLookups.createIndex(
    { tenantId: 1, requestId: 1 },
    { unique: true, partialFilterExpression: { requestId: { $type: 'string' } } }
  );

  await applyIdempotency.createIndex({ tenantId: 1, requestId: 1 }, { unique: true });
  await applyIdempotency.createIndex({ tenantId: 1, createdAt: 1 });

  await client.close();
  console.log(`✅ Identity lookup indexes ensured for tenant ${tenantId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
