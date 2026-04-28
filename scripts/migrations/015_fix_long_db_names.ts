import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { generateTenantDbName } from '../../lib/db/dbNameHelper';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  console.error('❌ MONGO_URL not found in .env.local');
  process.exit(1);
}

/**
 * Migration 015: Fix long database names
 * 
 * MongoDB Atlas has a maximum database name length of 38 bytes.
 * This migration updates tenant records with long dbNames to use short names.
 */
async function runMigration() {
  const client = new MongoClient(MONGO_URL);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const platformDb = client.db('sira_platform');
    const tenantsCollection = platformDb.collection('tenants');

    // Find all tenants
    const tenants = await tenantsCollection.find({}).toArray();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Migration 015: Fix Long Database Names');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Found ${tenants.length} tenants\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const tenant of tenants) {
      try {
        const tenantId = tenant.tenantId || (tenant as Record<string, unknown>).id || (tenant as Record<string, unknown>)._id?.toString();
        
        if (!tenantId) {
          console.warn(`⚠️  Skipping tenant without ID:`, tenant);
          skipped++;
          continue;
        }

        const currentDbName = (tenant as Record<string, unknown>).dbName as string || `sira_tenant__${tenantId}`;
        const newDbName = generateTenantDbName(tenantId);

        // Check if dbName needs updating (too long or uses old pattern)
        const needsUpdate = 
          currentDbName.length > 38 || // Too long
          currentDbName.startsWith('sira_tenant__') && currentDbName.length > 24; // Old pattern and long

        if (!needsUpdate && currentDbName === newDbName) {
          console.log(`⊘ Tenant "${tenantId}" already has short dbName: ${currentDbName}`);
          skipped++;
          continue;
        }

        // Update tenant record
        await tenantsCollection.updateOne(
          { tenantId },
          {
            $set: {
              dbName: newDbName,
              updatedAt: new Date(),
            },
          }
        );

        console.log(`✓ Updated tenant "${tenantId}":`);
        console.log(`  Old: ${currentDbName} (${currentDbName.length} chars)`);
        console.log(`  New: ${newDbName} (${newDbName.length} chars)\n`);
        updated++;

      } catch (error: unknown) {
        console.error(`✗ Error updating tenant:`, (error as Error).message);
        errors++;
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Migration Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`✅ Updated: ${updated}`);
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

