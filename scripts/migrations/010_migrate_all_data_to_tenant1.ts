/**
 * Migration 010: Migrate All Data to Tenant 1 (HMG TAK)
 * 
 * This migration assigns all existing data to tenantId = "1" (HMG TAK).
 * This ensures proper tenant isolation for existing demo data.
 * 
 * IMPORTANT:
 * - Users with role != 'thea-owner' and tenantId missing/null -> set tenantId = "1"
 * - thea-owner users are NOT modified (must remain without tenantId)
 * - All other collections: documents with missing/null tenantId -> set tenantId = "1"
 * 
 * Usage:
 *   npm run migrate:tenant1
 */

import { getCollection } from '../../lib/db';

const TARGET_TENANT_ID = '1'; // HMG TAK

interface MigrationResult {
  collection: string;
  updated: number;
  skipped: number;
  error?: string;
}

async function runMigration() {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Migration 010: Migrate All Data to Tenant 1 (HMG TAK)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const results: MigrationResult[] = [];
    const now = new Date();

    // 1. Users Collection
    console.log('📋 Migrating users collection...');
    try {
      const usersCollection = await getCollection('users');
      
      // Update non-thea-owner users without tenantId
      const userResult = await usersCollection.updateMany(
        {
          role: { $ne: 'thea-owner' },
          $or: [
            { tenantId: { $exists: false } },
            { tenantId: null },
            { tenantId: '' },
          ],
        },
        {
          $set: {
            tenantId: TARGET_TENANT_ID,
            updatedAt: now,
          },
        }
      );
      
      const skippedUsers = await usersCollection.countDocuments({
        role: { $ne: 'thea-owner' },
        tenantId: { $exists: true, $ne: null, $ne: '' },
      });
      
      results.push({
        collection: 'users',
        updated: userResult.modifiedCount,
        skipped: skippedUsers,
      });
      
      console.log(`   ✓ Updated ${userResult.modifiedCount} user(s)`);
      console.log(`   ⊘ Skipped ${skippedUsers} user(s) (already have tenantId)`);
    } catch (error: any) {
      console.error(`   ✗ Error: ${error.message}`);
      results.push({
        collection: 'users',
        updated: 0,
        skipped: 0,
        error: error.message,
      });
    }

    // 2. Policies Collection
    console.log('\n📋 Migrating policies collection...');
    try {
      const policiesCollection = await getCollection('policies');
      
      const policyResult = await policiesCollection.updateMany(
        {
          $or: [
            { tenantId: { $exists: false } },
            { tenantId: null },
            { tenantId: '' },
          ],
        },
        {
          $set: {
            tenantId: TARGET_TENANT_ID,
            updatedAt: now,
          },
        }
      );
      
      const skippedPolicies = await policiesCollection.countDocuments({
        tenantId: { $exists: true, $ne: null, $ne: '' },
      });
      
      results.push({
        collection: 'policies',
        updated: policyResult.modifiedCount,
        skipped: skippedPolicies,
      });
      
      console.log(`   ✓ Updated ${policyResult.modifiedCount} policy document(s)`);
      console.log(`   ⊘ Skipped ${skippedPolicies} policy document(s) (already have tenantId)`);
    } catch (error: any) {
      console.error(`   ✗ Error: ${error.message}`);
      results.push({
        collection: 'policies',
        updated: 0,
        skipped: 0,
        error: error.message,
      });
    }

    // 3. Groups Collection
    console.log('\n📋 Migrating groups collection...');
    try {
      const groupsCollection = await getCollection('groups');
      
      const groupResult = await groupsCollection.updateMany(
        {
          $or: [
            { tenantId: { $exists: false } },
            { tenantId: null },
            { tenantId: '' },
          ],
        },
        {
          $set: {
            tenantId: TARGET_TENANT_ID,
            updatedAt: now,
          },
        }
      );
      
      const skippedGroups = await groupsCollection.countDocuments({
        tenantId: { $exists: true, $ne: null, $ne: '' },
      });
      
      results.push({
        collection: 'groups',
        updated: groupResult.modifiedCount,
        skipped: skippedGroups,
      });
      
      console.log(`   ✓ Updated ${groupResult.modifiedCount} group(s)`);
      console.log(`   ⊘ Skipped ${skippedGroups} group(s) (already have tenantId)`);
    } catch (error: any) {
      console.error(`   ✗ Error: ${error.message}`);
      results.push({
        collection: 'groups',
        updated: 0,
        skipped: 0,
        error: error.message,
      });
    }

    // 4. Hospitals Collection
    console.log('\n📋 Migrating hospitals collection...');
    try {
      const hospitalsCollection = await getCollection('hospitals');
      
      const hospitalResult = await hospitalsCollection.updateMany(
        {
          $or: [
            { tenantId: { $exists: false } },
            { tenantId: null },
            { tenantId: '' },
          ],
        },
        {
          $set: {
            tenantId: TARGET_TENANT_ID,
            updatedAt: now,
          },
        }
      );
      
      const skippedHospitals = await hospitalsCollection.countDocuments({
        tenantId: { $exists: true, $ne: null, $ne: '' },
      });
      
      results.push({
        collection: 'hospitals',
        updated: hospitalResult.modifiedCount,
        skipped: skippedHospitals,
      });
      
      console.log(`   ✓ Updated ${hospitalResult.modifiedCount} hospital(s)`);
      console.log(`   ⊘ Skipped ${skippedHospitals} hospital(s) (already have tenantId)`);
    } catch (error: any) {
      console.error(`   ✗ Error: ${error.message}`);
      results.push({
        collection: 'hospitals',
        updated: 0,
        skipped: 0,
        error: error.message,
      });
    }

    // 5. Departments Collection
    console.log('\n📋 Migrating departments collection...');
    try {
      const departmentsCollection = await getCollection('departments');
      
      const deptResult = await departmentsCollection.updateMany(
        {
          $or: [
            { tenantId: { $exists: false } },
            { tenantId: null },
            { tenantId: '' },
          ],
        },
        {
          $set: {
            tenantId: TARGET_TENANT_ID,
            updatedAt: now,
          },
        }
      );
      
      const skippedDepts = await departmentsCollection.countDocuments({
        tenantId: { $exists: true, $ne: null, $ne: '' },
      });
      
      results.push({
        collection: 'departments',
        updated: deptResult.modifiedCount,
        skipped: skippedDepts,
      });
      
      console.log(`   ✓ Updated ${deptResult.modifiedCount} department(s)`);
      console.log(`   ⊘ Skipped ${skippedDepts} department(s) (already have tenantId)`);
    } catch (error: any) {
      console.error(`   ✗ Error: ${error.message}`);
      results.push({
        collection: 'departments',
        updated: 0,
        skipped: 0,
        error: error.message,
      });
    }

    // 6. Floors Collection
    console.log('\n📋 Migrating floors collection...');
    try {
      const floorsCollection = await getCollection('floors');
      
      const floorResult = await floorsCollection.updateMany(
        {
          $or: [
            { tenantId: { $exists: false } },
            { tenantId: null },
            { tenantId: '' },
          ],
        },
        {
          $set: {
            tenantId: TARGET_TENANT_ID,
            updatedAt: now,
          },
        }
      );
      
      const skippedFloors = await floorsCollection.countDocuments({
        tenantId: { $exists: true, $ne: null, $ne: '' },
      });
      
      results.push({
        collection: 'floors',
        updated: floorResult.modifiedCount,
        skipped: skippedFloors,
      });
      
      console.log(`   ✓ Updated ${floorResult.modifiedCount} floor(s)`);
      console.log(`   ⊘ Skipped ${skippedFloors} floor(s) (already have tenantId)`);
    } catch (error: any) {
      console.error(`   ✗ Error: ${error.message}`);
      results.push({
        collection: 'floors',
        updated: 0,
        skipped: 0,
        error: error.message,
      });
    }

    // 7. Rooms Collection
    console.log('\n📋 Migrating rooms collection...');
    try {
      const roomsCollection = await getCollection('rooms');
      
      const roomResult = await roomsCollection.updateMany(
        {
          $or: [
            { tenantId: { $exists: false } },
            { tenantId: null },
            { tenantId: '' },
          ],
        },
        {
          $set: {
            tenantId: TARGET_TENANT_ID,
            updatedAt: now,
          },
        }
      );
      
      const skippedRooms = await roomsCollection.countDocuments({
        tenantId: { $exists: true, $ne: null, $ne: '' },
      });
      
      results.push({
        collection: 'rooms',
        updated: roomResult.modifiedCount,
        skipped: skippedRooms,
      });
      
      console.log(`   ✓ Updated ${roomResult.modifiedCount} room(s)`);
      console.log(`   ⊘ Skipped ${skippedRooms} room(s) (already have tenantId)`);
    } catch (error: any) {
      console.error(`   ✗ Error: ${error.message}`);
      results.push({
        collection: 'rooms',
        updated: 0,
        skipped: 0,
        error: error.message,
      });
    }

    // 8. OPD Data Collections
    const opdCollections = [
      'opd_daily_data',
      'opd_manpower_doctors',
      'opd_manpower_nurses',
      'opd_manpower_clinics',
      'opd_rooms',
      'opd_census',
    ];

    for (const collectionName of opdCollections) {
      console.log(`\n📋 Migrating ${collectionName} collection...`);
      try {
        const collection = await getCollection(collectionName);
        
        const result = await collection.updateMany(
          {
            $or: [
              { tenantId: { $exists: false } },
              { tenantId: null },
              { tenantId: '' },
            ],
          },
          {
            $set: {
              tenantId: TARGET_TENANT_ID,
              updatedAt: now,
            },
          }
        );
        
        const skipped = await collection.countDocuments({
          tenantId: { $exists: true, $ne: null, $ne: '' },
        });
        
        results.push({
          collection: collectionName,
          updated: result.modifiedCount,
          skipped,
        });
        
        console.log(`   ✓ Updated ${result.modifiedCount} document(s)`);
        console.log(`   ⊘ Skipped ${skipped} document(s) (already have tenantId)`);
      } catch (error: any) {
        console.error(`   ✗ Error: ${error.message}`);
        results.push({
          collection: collectionName,
          updated: 0,
          skipped: 0,
          error: error.message,
        });
      }
    }

    // 9. Patient Experience Collections
    const pxCollections = [
      'patient_experience', // Main collection for visits
      'px_cases', // Cases collection
    ];

    for (const collectionName of pxCollections) {
      console.log(`\n📋 Migrating ${collectionName} collection...`);
      try {
        const collection = await getCollection(collectionName);
        
        const result = await collection.updateMany(
          {
            $or: [
              { tenantId: { $exists: false } },
              { tenantId: null },
              { tenantId: '' },
            ],
          },
          {
            $set: {
              tenantId: TARGET_TENANT_ID,
              updatedAt: now,
            },
          }
        );
        
        const skipped = await collection.countDocuments({
          tenantId: { $exists: true, $ne: null, $ne: '' },
        });
        
        results.push({
          collection: collectionName,
          updated: result.modifiedCount,
          skipped,
        });
        
        console.log(`   ✓ Updated ${result.modifiedCount} document(s)`);
        console.log(`   ⊘ Skipped ${skipped} document(s) (already have tenantId)`);
      } catch (error: any) {
        console.error(`   ✗ Error: ${error.message}`);
        results.push({
          collection: collectionName,
          updated: 0,
          skipped: 0,
          error: error.message,
        });
      }
    }

    // 10. EHR Collections
    const ehrCollections = [
      'ehr_patients',
      'ehr_encounters',
      'ehr_notes',
      'ehr_orders',
      'ehr_tasks',
    ];

    for (const collectionName of ehrCollections) {
      console.log(`\n📋 Migrating ${collectionName} collection...`);
      try {
        const collection = await getCollection(collectionName);
        
        const result = await collection.updateMany(
          {
            $or: [
              { tenantId: { $exists: false } },
              { tenantId: null },
              { tenantId: '' },
            ],
          },
          {
            $set: {
              tenantId: TARGET_TENANT_ID,
              updatedAt: now,
            },
          }
        );
        
        const skipped = await collection.countDocuments({
          tenantId: { $exists: true, $ne: null, $ne: '' },
        });
        
        results.push({
          collection: collectionName,
          updated: result.modifiedCount,
          skipped,
        });
        
        console.log(`   ✓ Updated ${result.modifiedCount} document(s)`);
        console.log(`   ⊘ Skipped ${skipped} document(s) (already have tenantId)`);
      } catch (error: any) {
        console.error(`   ✗ Error: ${error.message}`);
        results.push({
          collection: collectionName,
          updated: 0,
          skipped: 0,
          error: error.message,
        });
      }
    }

    // 11. Nursing Scheduling
    console.log('\n📋 Migrating nursing_scheduling collection...');
    try {
      const collection = await getCollection('nursing_scheduling');
      
      const result = await collection.updateMany(
        {
          $or: [
            { tenantId: { $exists: false } },
            { tenantId: null },
            { tenantId: '' },
          ],
        },
        {
          $set: {
            tenantId: TARGET_TENANT_ID,
            updatedAt: now,
          },
        }
      );
      
      const skipped = await collection.countDocuments({
        tenantId: { $exists: true, $ne: null, $ne: '' },
      });
      
      results.push({
        collection: 'nursing_scheduling',
        updated: result.modifiedCount,
        skipped,
      });
      
      console.log(`   ✓ Updated ${result.modifiedCount} document(s)`);
      console.log(`   ⊘ Skipped ${skipped} document(s) (already have tenantId)`);
    } catch (error: any) {
      console.error(`   ✗ Error: ${error.message}`);
      results.push({
        collection: 'nursing_scheduling',
        updated: 0,
        skipped: 0,
        error: error.message,
      });
    }

    // 12. Equipment
    console.log('\n📋 Migrating equipment collection...');
    try {
      const collection = await getCollection('equipment');
      
      const result = await collection.updateMany(
        {
          $or: [
            { tenantId: { $exists: false } },
            { tenantId: null },
            { tenantId: '' },
          ],
        },
        {
          $set: {
            tenantId: TARGET_TENANT_ID,
            updatedAt: now,
          },
        }
      );
      
      const skipped = await collection.countDocuments({
        tenantId: { $exists: true, $ne: null, $ne: '' },
      });
      
      results.push({
        collection: 'equipment',
        updated: result.modifiedCount,
        skipped,
      });
      
      console.log(`   ✓ Updated ${result.modifiedCount} document(s)`);
      console.log(`   ⊘ Skipped ${skipped} document(s) (already have tenantId)`);
    } catch (error: any) {
      console.error(`   ✗ Error: ${error.message}`);
      results.push({
        collection: 'equipment',
        updated: 0,
        skipped: 0,
        error: error.message,
      });
    }

    // 13. Risk Detector
    const riskCollections = [
      'risk_detector_practices',
      'risk_detector_runs',
    ];

    for (const collectionName of riskCollections) {
      console.log(`\n📋 Migrating ${collectionName} collection...`);
      try {
        const collection = await getCollection(collectionName);
        
        const result = await collection.updateMany(
          {
            $or: [
              { tenantId: { $exists: false } },
              { tenantId: null },
              { tenantId: '' },
            ],
          },
          {
            $set: {
              tenantId: TARGET_TENANT_ID,
              updatedAt: now,
            },
          }
        );
        
        const skipped = await collection.countDocuments({
          tenantId: { $exists: true, $ne: null, $ne: '' },
        });
        
        results.push({
          collection: collectionName,
          updated: result.modifiedCount,
          skipped,
        });
        
        console.log(`   ✓ Updated ${result.modifiedCount} document(s)`);
        console.log(`   ⊘ Skipped ${skipped} document(s) (already have tenantId)`);
      } catch (error: any) {
        console.error(`   ✗ Error: ${error.message}`);
        results.push({
          collection: collectionName,
          updated: 0,
          skipped: 0,
          error: error.message,
        });
      }
    }

    // 14. Audit Logs (optional - may not need tenantId, but add for consistency)
    console.log('\n📋 Migrating audit_logs collection...');
    try {
      const collection = await getCollection('audit_logs');
      
      const result = await collection.updateMany(
        {
          $or: [
            { tenantId: { $exists: false } },
            { tenantId: null },
            { tenantId: '' },
          ],
        },
        {
          $set: {
            tenantId: TARGET_TENANT_ID,
            updatedAt: now,
          },
        }
      );
      
      const skipped = await collection.countDocuments({
        tenantId: { $exists: true, $ne: null, $ne: '' },
      });
      
      results.push({
        collection: 'audit_logs',
        updated: result.modifiedCount,
        skipped,
      });
      
      console.log(`   ✓ Updated ${result.modifiedCount} document(s)`);
      console.log(`   ⊘ Skipped ${skipped} document(s) (already have tenantId)`);
    } catch (error: any) {
      console.error(`   ✗ Error: ${error.message}`);
      results.push({
        collection: 'audit_logs',
        updated: 0,
        skipped: 0,
        error: error.message,
      });
    }

    // 15. Clinical Events & Policy Alerts (already have tenantId, but ensure consistency)
    const integrationCollections = [
      'clinical_events',
      'policy_alerts',
    ];

    for (const collectionName of integrationCollections) {
      console.log(`\n📋 Migrating ${collectionName} collection...`);
      try {
        const collection = await getCollection(collectionName);
        
        const result = await collection.updateMany(
          {
            $or: [
              { tenantId: { $exists: false } },
              { tenantId: null },
              { tenantId: '' },
            ],
          },
          {
            $set: {
              tenantId: TARGET_TENANT_ID,
              updatedAt: now,
            },
          }
        );
        
        const skipped = await collection.countDocuments({
          tenantId: { $exists: true, $ne: null, $ne: '' },
        });
        
        results.push({
          collection: collectionName,
          updated: result.modifiedCount,
          skipped,
        });
        
        console.log(`   ✓ Updated ${result.modifiedCount} document(s)`);
        console.log(`   ⊘ Skipped ${skipped} document(s) (already have tenantId)`);
      } catch (error: any) {
        console.error(`   ✗ Error: ${error.message}`);
        results.push({
          collection: collectionName,
          updated: 0,
          skipped: 0,
          error: error.message,
        });
      }
    }

    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migration completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
    const errors = results.filter(r => r.error);

    console.log('📊 Summary:');
    console.log(`   Total documents updated: ${totalUpdated}`);
    console.log(`   Total documents skipped (already had tenantId): ${totalSkipped}`);
    console.log(`   Collections with errors: ${errors.length}\n`);

    if (errors.length > 0) {
      console.log('⚠️  Collections with errors:');
      errors.forEach(r => {
        console.log(`   - ${r.collection}: ${r.error}`);
      });
      console.log('');
    }

    console.log('📋 Per-collection results:');
    results.forEach(r => {
      if (r.error) {
        console.log(`   ✗ ${r.collection}: ERROR - ${r.error}`);
      } else {
        console.log(`   ✓ ${r.collection}: ${r.updated} updated, ${r.skipped} skipped`);
      }
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

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

