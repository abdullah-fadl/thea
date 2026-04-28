import { MongoClient } from 'mongodb';

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  const tenantId = process.env.ER_TENANT_ID || process.env.TENANT_ID;
  if (!uri) throw new Error('Missing MONGODB_URI/MONGO_URL');
  if (!tenantId) throw new Error('Missing ER_TENANT_ID/TENANT_ID');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const facilities = db.collection('clinical_infra_facilities');
  const units = db.collection('clinical_infra_units');
  const floors = db.collection('clinical_infra_floors');
  const rooms = db.collection('clinical_infra_rooms');
  const beds = db.collection('clinical_infra_beds');
  const specialties = db.collection('clinical_infra_specialties');
  const clinics = db.collection('clinical_infra_clinics');
  const providers = db.collection('clinical_infra_providers');
  const profiles = db.collection('clinical_infra_provider_profiles');
  const privileges = db.collection('clinical_infra_provider_privileges');
  const roomAssignments = db.collection('clinical_infra_provider_room_assignments');
  const unitScopes = db.collection('clinical_infra_provider_unit_scopes');
  const idempotency = db.collection('clinical_infra_idempotency');

  const common = async (col: any) => {
    await col.createIndex({ tenantId: 1, id: 1 }, { unique: true });
    await col.createIndex({ tenantId: 1, createdAt: 1, _id: 1 });
    await col.createIndex({ tenantId: 1, isArchived: 1, createdAt: 1, _id: 1 });
  };

  await common(facilities);
  await common(units);
  await common(floors);
  await common(rooms);
  await common(beds);
  await common(specialties);
  await common(clinics);
  await common(providers);
  await common(profiles);
  await common(privileges);
  await common(roomAssignments);
  await common(unitScopes);

  // Useful lookup indexes
  await units.createIndex({ tenantId: 1, facilityId: 1, createdAt: 1, _id: 1 });
  await floors.createIndex({ tenantId: 1, facilityId: 1, createdAt: 1, _id: 1 });
  await rooms.createIndex({ tenantId: 1, unitId: 1, floorId: 1, createdAt: 1, _id: 1 });
  // Reject duplicates gracefully (operational uniqueness within same unit)
  await rooms.createIndex({ tenantId: 1, unitId: 1, name: 1 }, { unique: true });
  await beds.createIndex({ tenantId: 1, roomId: 1, status: 1, createdAt: 1, _id: 1 });
  await clinics.createIndex({ tenantId: 1, unitId: 1, specialtyId: 1, createdAt: 1, _id: 1 });
  await profiles.createIndex({ tenantId: 1, providerId: 1 }, { unique: true });
  await privileges.createIndex({ tenantId: 1, providerId: 1 }, { unique: true });
  await roomAssignments.createIndex({ tenantId: 1, providerId: 1 }, { unique: true });
  await unitScopes.createIndex({ tenantId: 1, providerId: 1 }, { unique: true });

  // Idempotency replay keys
  await idempotency.createIndex({ tenantId: 1, key: 1, method: 1, pathname: 1 }, { unique: true });
  await idempotency.createIndex({ tenantId: 1, createdAt: 1 });

  await client.close();
  console.log(`✅ Clinical infra indexes ensured for tenant ${tenantId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

