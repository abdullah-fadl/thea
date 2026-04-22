import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  console.error('❌ MONGO_URL not found in .env.local');
  process.exit(1);
}

/**
 * Migration 014: Migrate users from hospital_ops to tenant DBs
 * 
 * This migration moves user records from the old hospital_ops DB
 * to their respective tenant DBs based on tenantId.
 */
async function runMigration() {
  const client = new MongoClient(MONGO_URL);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const oldDb = client.db('hospital_ops');
    const platformDb = client.db('thea_platform');

    const oldUsersCollection = oldDb.collection('users');
    const tenantsCollection = platformDb.collection('tenants');

    // Get all users from old DB (excluding thea-owner)
    const oldUsers = await oldUsersCollection.find({
      role: { $ne: 'thea-owner' }
    }).toArray();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Migration 014: Migrate Users to Tenant DBs');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Found ${oldUsers.length} users in hospital_ops DB\n`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    // Group users by tenantId
    const usersByTenant = new Map<string, Record<string, unknown>[]>();

    for (const user of oldUsers) {
      const tenantId = user.tenantId || (user as Record<string, unknown>).id;
      
      if (!tenantId) {
        console.warn(`⚠️  Skipping user without tenantId: ${user.email}`);
        skipped++;
        continue;
      }

      if (!usersByTenant.has(tenantId)) {
        usersByTenant.set(tenantId, []);
      }
      usersByTenant.get(tenantId)!.push(user);
    }

    // Migrate users for each tenant
    for (const [tenantId, users] of usersByTenant.entries()) {
      try {
        // Find tenant in platform DB to get dbName
        const tenant = await tenantsCollection.findOne({ tenantId });
        
        if (!tenant) {
          console.warn(`⚠️  Tenant ${tenantId} not found in platform DB, skipping ${users.length} users`);
          skipped += users.length;
          continue;
        }

        const dbName = (tenant as Record<string, unknown>).dbName || `thea_tenant__${tenantId}`;
        const tenantDb = client.db(dbName);
        const tenantUsersCollection = tenantDb.collection('users');

        console.log(`\n📋 Migrating ${users.length} users to ${dbName} (${tenant.name || tenantId})...`);

        for (const user of users) {
          try {
            // Check if user already exists in tenant DB (by email)
            const existing = await tenantUsersCollection.findOne({ email: user.email });
            
            if (existing) {
              console.log(`  ⊘ User ${user.email} already exists in tenant DB, skipping`);
              skipped++;
              continue;
            }

            // Remove tenantId from user object (not needed in tenant DB)
            const { tenantId: _, ...userWithoutTenantId } = user;
            
            // Insert user into tenant DB
            await tenantUsersCollection.insertOne(userWithoutTenantId);
            console.log(`  ✓ Migrated user: ${user.email} (${user.role || 'N/A'})`);
            migrated++;

          } catch (error: unknown) {
            console.error(`  ✗ Error migrating user ${user.email}:`, (error as Error).message);
            errors++;
          }
        }

      } catch (error: unknown) {
        console.error(`✗ Error processing tenant ${tenantId}:`, (error as Error).message);
        errors += users.length;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Migration Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`✅ Migrated: ${migrated}`);
    console.log(`⊘ Skipped: ${skipped}`);
    console.log(`✗ Errors: ${errors}`);
    console.log('\n✅ Migration completed!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

runMigration();

