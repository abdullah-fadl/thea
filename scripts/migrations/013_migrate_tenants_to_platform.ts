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
 * Migration 013: Migrate tenants from hospital_ops to sira_platform
 * 
 * This migration moves tenant records from the old hospital_ops DB
 * to the new sira_platform DB structure.
 */
async function runMigration() {
  const client = new MongoClient(MONGO_URL);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const oldDb = client.db('hospital_ops');
    const platformDb = client.db('sira_platform');

    const oldTenantsCollection = oldDb.collection('tenants');
    const platformTenantsCollection = platformDb.collection('tenants');

    // Find all tenants in old DB
    const oldTenants = await oldTenantsCollection.find({}).toArray();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Migration 013: Migrate Tenants to Platform DB');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Found ${oldTenants.length} tenants in hospital_ops DB\n`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const oldTenant of oldTenants) {
      try {
        const tenantId = oldTenant.tenantId || (oldTenant as Record<string, unknown>).id || (oldTenant as Record<string, unknown>)._id?.toString();
        
        if (!tenantId) {
          console.warn(`⚠️  Skipping tenant without ID:`, oldTenant);
          skipped++;
          continue;
        }

        // Check if tenant already exists in platform DB
        const existing = await platformTenantsCollection.findOne({
          tenantId: tenantId
        });

        if (existing) {
          console.log(`⊘ Tenant "${tenantId}" already exists in sira_platform, skipping`);
          skipped++;
          continue;
        }

        // Generate dbName for tenant
        const dbName = `sira_tenant__${tenantId}`;

        // Migrate tenant to platform DB
        const newTenant = {
          tenantId: tenantId,
          name: oldTenant.name || oldTenant.tenantId,
          dbName: dbName,
          entitlements: oldTenant.entitlements || {
            sam: true,
            health: true,
            edrac: false,
            cvision: false,
          },
          status: oldTenant.status || 'active',
          planType: oldTenant.planType || 'demo',
          subscriptionEndsAt: oldTenant.subscriptionEndsAt,
          maxUsers: oldTenant.maxUsers || 10,
          createdAt: oldTenant.createdAt || new Date(),
          updatedAt: new Date(),
          createdBy: oldTenant.createdBy || 'migration',
        };

        await platformTenantsCollection.insertOne(newTenant);
        console.log(`✓ Migrated tenant: ${tenantId} (${oldTenant.name || 'N/A'})`);
        migrated++;

      } catch (error: unknown) {
        console.error(`✗ Error migrating tenant:`, (error as Error).message);
        errors++;
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

