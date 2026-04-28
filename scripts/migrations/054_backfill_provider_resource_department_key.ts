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
  const filter = {
    tenantId,
    resourceType: 'PROVIDER',
    departmentKey: { $regex: /^provider:/i },
  };

  const now = new Date();
  const res = await resources.updateMany(filter, { $set: { departmentKey: 'opd', updatedAt: now } });

  await client.close();
  console.log(`✅ Backfilled provider departmentKey -> opd for tenant ${tenantId}: matched=${res.matchedCount} modified=${res.modifiedCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

