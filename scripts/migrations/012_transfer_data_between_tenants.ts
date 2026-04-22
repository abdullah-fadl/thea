/**
 * Migration 012: Transfer Data Between Tenants
 * 
 * This migration transfers all Patient Experience data from one tenant to another.
 * 
 * IMPORTANT:
 * - This will update tenantId for all PX-related collections
 * - Source tenant data will be moved to target tenant
 * - Use with caution - this is a destructive operation
 * 
 * Usage:
 *   npm run migrate:transfer-tenants
 * 
 * Or run directly:
 *   tsx scripts/migrations/012_transfer_data_between_tenants.ts
 */

import { getCollection } from '../../lib/db';

// CONFIGURATION: Update these tenant IDs
// Note: These can be either tenantId or _id (ObjectId)
const SOURCE_TENANT_ID = '6957c2a459b69c9ecf0fbd11';
const TARGET_TENANT_ID = '6957fb92784a84e764b3a750';

interface MigrationResult {
  collection: string;
  updated: number;
  error?: string;
}

// Collections that need tenant migration for Patient Experience
const PX_COLLECTIONS = [
  'floors',
  'floor_departments',
  'floor_rooms',
  'complaint_domains',
  'complaint_types',
  'nursing_complaint_types',
  'praise_categories',
  'sla_rules',
  'patient_experience',
  'px_cases',
  'px_case_audits',
  'notifications', // Only PX-related notifications
];

async function runMigration() {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Migration 012: Transfer Data Between Tenants');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Source Tenant ID: ${SOURCE_TENANT_ID}`);
    console.log(`Target Tenant ID: ${TARGET_TENANT_ID}\n`);

    // Validate tenant IDs
    if (!SOURCE_TENANT_ID || !TARGET_TENANT_ID) {
      throw new Error('Source and Target tenant IDs are required');
    }

    if (SOURCE_TENANT_ID === TARGET_TENANT_ID) {
      throw new Error('Source and Target tenant IDs cannot be the same');
    }

    // Verify tenants exist (try by tenantId first, then by _id)
    const tenantsCollection = await getCollection('tenants');
    let sourceTenant = await tenantsCollection.findOne({ tenantId: SOURCE_TENANT_ID });
    let targetTenant = await tenantsCollection.findOne({ tenantId: TARGET_TENANT_ID });

    // If not found by tenantId, try by _id (fallback for old data)
    if (!sourceTenant) {
      const { ObjectId } = await import('mongodb');
      if (SOURCE_TENANT_ID && SOURCE_TENANT_ID.length === 24 && /^[0-9a-fA-F]{24}$/.test(SOURCE_TENANT_ID)) {
        try {
          sourceTenant = await tenantsCollection.findOne({ _id: new ObjectId(SOURCE_TENANT_ID) });
        } catch (error) {
          // Ignore ObjectId parsing errors
        }
      }
    }

    if (!targetTenant) {
      const { ObjectId } = await import('mongodb');
      if (TARGET_TENANT_ID && TARGET_TENANT_ID.length === 24 && /^[0-9a-fA-F]{24}$/.test(TARGET_TENANT_ID)) {
        try {
          targetTenant = await tenantsCollection.findOne({ _id: new ObjectId(TARGET_TENANT_ID) });
        } catch (error) {
          // Ignore ObjectId parsing errors
        }
      }
    }

    if (!sourceTenant) {
      throw new Error(`Source tenant ${SOURCE_TENANT_ID} not found (searched by tenantId and _id)`);
    }

    if (!targetTenant) {
      throw new Error(`Target tenant ${TARGET_TENANT_ID} not found (searched by tenantId and _id)`);
    }

    // Get actual tenantId from found tenants
    const actualSourceTenantId = sourceTenant.tenantId || SOURCE_TENANT_ID;
    const actualTargetTenantId = targetTenant.tenantId || TARGET_TENANT_ID;

    console.log(`✓ Source tenant found: ${sourceTenant.name || actualSourceTenantId} (tenantId: ${actualSourceTenantId})`);
    console.log(`✓ Target tenant found: ${targetTenant.name || actualTargetTenantId} (tenantId: ${actualTargetTenantId})\n`);

    const results: MigrationResult[] = [];
    const now = new Date();

    // Migrate each collection
    for (const collectionName of PX_COLLECTIONS) {
      console.log(`📋 Migrating ${collectionName}...`);
      try {
        const collection = await getCollection(collectionName);

        // Count documents to migrate (from source tenant OR without tenantId)
        const countWithTenant = await collection.countDocuments({ tenantId: actualSourceTenantId });
        const countWithoutTenant = await collection.countDocuments({
          $or: [
            { tenantId: { $exists: false } },
            { tenantId: null },
            { tenantId: '' },
          ],
        });
        const totalCount = countWithTenant + countWithoutTenant;
        
        console.log(`   Found ${countWithTenant} documents with source tenantId, ${countWithoutTenant} without tenantId (total: ${totalCount})`);

        if (totalCount === 0) {
          console.log(`   ⏭️  Skipping ${collectionName} (no documents found)\n`);
          results.push({ collection: collectionName, updated: 0 });
          continue;
        }

        // Update tenantId for documents with source tenantId
        let updatedCount = 0;
        if (countWithTenant > 0) {
          const updateResult1 = await collection.updateMany(
            { tenantId: actualSourceTenantId },
            {
              $set: {
                tenantId: actualTargetTenantId,
                updatedAt: now,
              },
            }
          );
          updatedCount += updateResult1.modifiedCount;
        }

        // Update tenantId for documents without tenantId (migrate to target tenant)
        if (countWithoutTenant > 0) {
          const updateResult2 = await collection.updateMany(
            {
              $or: [
                { tenantId: { $exists: false } },
                { tenantId: null },
                { tenantId: '' },
              ],
            },
            {
              $set: {
                tenantId: actualTargetTenantId,
                updatedAt: now,
              },
            }
          );
          updatedCount += updateResult2.modifiedCount;
        }

        console.log(`   ✓ Updated ${updatedCount} documents\n`);
        results.push({
          collection: collectionName,
          updated: updatedCount,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`   ✗ Error migrating ${collectionName}: ${errorMessage}\n`);
        results.push({
          collection: collectionName,
          updated: 0,
          error: errorMessage,
        });
      }
    }

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Migration Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let totalUpdated = 0;
    let successCount = 0;
    let errorCount = 0;

    for (const result of results) {
      if (result.error) {
        console.error(`✗ ${result.collection}: ERROR - ${result.error}`);
        errorCount++;
      } else {
        console.log(`✓ ${result.collection}: ${result.updated} documents updated`);
        totalUpdated += result.updated;
        successCount++;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total: ${totalUpdated} documents migrated`);
    console.log(`Success: ${successCount} collections`);
    console.log(`Errors: ${errorCount} collections`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (errorCount > 0) {
      console.error('⚠️  Migration completed with errors. Please review the output above.');
      process.exit(1);
    } else {
      console.log('✅ Migration completed successfully!');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
runMigration();

