import { MongoClient } from 'mongodb';

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  const tenantId = process.env.ER_TENANT_ID || process.env.TENANT_ID;
  if (!uri) throw new Error('Missing MONGODB_URI/MONGO_URL');
  if (!tenantId) throw new Error('Missing ER_TENANT_ID/TENANT_ID');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const notifications = db.collection('notifications');
  const events = db.collection('notification_events');

  await notifications.createIndex({ tenantId: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $exists: true } } });
  await notifications.createIndex({ tenantId: 1, recipientUserId: 1, status: 1, createdAt: -1 });
  await notifications.createIndex({ tenantId: 1, scope: 1, status: 1, createdAt: -1 });

  await events.createIndex({ tenantId: 1, notificationId: 1, createdAt: 1 });

  await client.close();
  console.log(`✅ Notifications indexes ensured for tenant ${tenantId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
