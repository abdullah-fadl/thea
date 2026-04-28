/**
 * Migration: Tenant Entitlements
 * 
 * Creates tenants collection with default tenant and entitlements.
 * Sets safe defaults: sam=true, health=true, edrac=false, cvision=false
 * 
 * Run with: npx tsx scripts/migrations/003_tenant_entitlements.ts
 */

import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hospital_ops';

interface Tenant {
  tenantId: string;
  name?: string;
  entitlements: {
    sam: boolean;
    health: boolean;
    edrac: boolean;
    cvision: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

async function runMigration() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DB_NAME);
    const tenantsCollection = db.collection('tenants');
    const sessionsCollection = db.collection('sessions');

    // Create indexes for tenants collection
    console.log('Creating indexes for tenants collection...');
    await tenantsCollection.createIndex({ tenantId: 1 }, { unique: true });
    console.log('✓ Tenants indexes created');

    // Find all unique tenantIds from existing sessions
    console.log('Discovering existing tenantIds from sessions...');
    const existingTenantIds = await sessionsCollection.distinct('tenantId');
    const uniqueTenantIds = [...new Set(existingTenantIds.filter((id): id is string => !!id))];
    console.log(`Found ${uniqueTenantIds.length} unique tenantIds:`, uniqueTenantIds);

    // If no tenantIds found, use 'default'
    const tenantIdsToCreate = uniqueTenantIds.length > 0 ? uniqueTenantIds : ['default'];
    
    // Create tenant records with safe defaults
    console.log('Creating tenant records with safe defaults...');
    const now = new Date();
    
    for (const tenantId of tenantIdsToCreate) {
      const existingTenant = await tenantsCollection.findOne({ tenantId });
      
      if (!existingTenant) {
        const tenant: Tenant = {
          tenantId,
          name: tenantId === 'default' ? 'Default Tenant' : undefined,
          entitlements: {
            sam: true,      // Safe default - allow SAM
            health: true,   // Safe default - allow Health
            edrac: false,   // Coming soon
            cvision: false, // Coming soon
          },
          createdAt: now,
          updatedAt: now,
        };
        
        await tenantsCollection.insertOne(tenant);
        console.log(`✓ Created tenant: ${tenantId}`);
      } else {
        console.log(`⊘ Tenant already exists: ${tenantId}`);
        
        // Ensure entitlements exist (migration safety)
        if (!existingTenant.entitlements) {
          await tenantsCollection.updateOne(
            { tenantId },
            {
              $set: {
                entitlements: {
                  sam: true,
                  health: true,
                  edrac: false,
                  cvision: false,
                },
                updatedAt: now,
              },
            }
          );
          console.log(`✓ Updated tenant entitlements: ${tenantId}`);
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log(`Created/verified ${tenantIdsToCreate.length} tenant(s) with safe defaults.`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run migration if executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { runMigration };

