import { MongoClient } from 'mongodb';

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  const tenantId = process.env.ER_TENANT_ID || process.env.TENANT_ID;
  if (!uri) throw new Error('Missing MONGODB_URI/MONGO_URL');
  if (!tenantId) throw new Error('Missing ER_TENANT_ID/TENANT_ID');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const tenantUsers = db.collection('tenant_users');
  await tenantUsers.createIndex({ tenantId: 1, userId: 1 }, { unique: true });
  await tenantUsers.createIndex({ tenantId: 1, roles: 1 });
  await tenantUsers.createIndex({ tenantId: 1, areas: 1 });
  await tenantUsers.createIndex({ tenantId: 1, isActive: 1 });

  await client.close();
  console.log(`✅ tenant_users indexes ensured for tenant ${tenantId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
