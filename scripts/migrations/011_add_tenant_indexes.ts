/**
 * Migration 011: Add Tenant Indexes
 * 
 * Creates indexes on tenantId field for all tenant-scoped collections
 * to improve query performance for tenant isolation.
 * 
 * Usage:
 *   npx tsx scripts/migrations/011_add_tenant_indexes.ts
 */

import { getCollection } from '../../lib/db';

const COLLECTIONS_WITH_TENANT = [
  'users',
  'policies',
  'policy_documents',
  'groups',
  'hospitals',
  'departments',
  'floors',
  'rooms',
  'opd_daily_data',
  'opd_manpower_doctors',
  'opd_manpower_nurses',
  'opd_manpower_clinics',
  'opd_rooms',
  'opd_census',
  'patient_experience_data',
  'patient_experience_visits',
  'patient_experience_cases',
  'ehr_patients',
  'ehr_encounters',
  'ehr_notes',
  'ehr_orders',
  'ehr_tasks',
  'nursing_scheduling',
  'equipment',
  'risk_detector_practices',
  'risk_detector_runs',
  'clinical_events',
  'policy_alerts',
  'audit_logs',
];

async function runMigration() {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Migration 011: Add Tenant Indexes');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const results: Array<{ collection: string; created: boolean; error?: string }> = [];

    for (const collectionName of COLLECTIONS_WITH_TENANT) {
      console.log(`📋 Creating index for ${collectionName}...`);
      try {
        const collection = await getCollection(collectionName);
        
        // Create index on tenantId
        await collection.createIndex({ tenantId: 1 });
        
        results.push({
          collection: collectionName,
          created: true,
        });
        
        console.log(`   ✓ Index created on tenantId`);
      } catch (error: any) {
        // Index might already exist, which is fine
        if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
          console.log(`   ⊘ Index already exists`);
          results.push({
            collection: collectionName,
            created: false,
          });
        } else {
          console.error(`   ✗ Error: ${error.message}`);
          results.push({
            collection: collectionName,
            created: false,
            error: error.message,
          });
        }
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migration completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const created = results.filter(r => r.created).length;
    const skipped = results.filter(r => !r.created && !r.error).length;
    const errors = results.filter(r => r.error);

    console.log('📊 Summary:');
    console.log(`   Indexes created: ${created}`);
    console.log(`   Indexes already existed: ${skipped}`);
    console.log(`   Errors: ${errors.length}\n`);

    if (errors.length > 0) {
      console.log('⚠️  Collections with errors:');
      errors.forEach(r => {
        console.log(`   - ${r.collection}: ${r.error}`);
      });
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runMigration();
}

export { runMigration };

