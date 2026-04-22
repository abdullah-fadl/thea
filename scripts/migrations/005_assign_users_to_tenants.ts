/**
 * Migration 005: Assign Users to Tenants (Phase 5)
 * 
 * Temporary migration to assign all non-thea-owner users without tenantId
 * to the first active tenant (HMG TAK).
 * 
 * This is a temporary Phase-5 migration and can be removed later.
 * 
 * Usage:
 *   npx tsx scripts/migrations/005_assign_users_to_tenants.ts
 */

import { getCollection } from '../../lib/db';
import { User } from '../../lib/models/User';
import { Tenant } from '../../lib/models/Tenant';

async function runMigration() {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Migration 005: Assign Users to Tenants');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const usersCollection = await getCollection('users');
    const tenantsCollection = await getCollection('tenants');

    // Find the first active tenant (preferably "HMG TAK", otherwise first active)
    let targetTenant: Tenant | null = null;

    // Try to find "HMG TAK" tenant first (case-insensitive search)
    targetTenant = await tenantsCollection.findOne<Tenant>({
      $or: [
        { tenantId: { $regex: /^hmg.tak$/i } },
        { name: { $regex: /^hmg.tak$/i } },
      ],
      status: 'active',
    });

    // If not found, get the first active tenant
    if (!targetTenant) {
      targetTenant = await tenantsCollection.findOne<Tenant>(
        { status: 'active' },
        { sort: { createdAt: 1 } } // Oldest first
      );
    }

    if (!targetTenant) {
      console.error('❌ Error: No active tenant found.');
      console.log('   Please create at least one active tenant before running this migration.');
      process.exit(1);
    }

    console.log(`✓ Target tenant found: ${targetTenant.tenantId}${targetTenant.name ? ` (${targetTenant.name})` : ''}`);

    // Find all users that need assignment:
    // - role !== 'thea-owner'
    // - tenantId is null, undefined, or empty string
    const usersToAssign = await usersCollection
      .find<User>({
        role: { $ne: 'thea-owner' },
        $or: [
          { tenantId: { $exists: false } },
          { tenantId: null },
          { tenantId: '' },
        ],
      })
      .toArray();

    console.log(`\n📊 Found ${usersToAssign.length} user(s) without tenant assignment`);

    if (usersToAssign.length === 0) {
      console.log('✅ All users are already assigned to tenants. Migration complete.');
      process.exit(0);
    }

    // Display users to be assigned
    console.log('\n📋 Users to be assigned:');
    usersToAssign.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.role})`);
    });

    // Assign users to target tenant
    const now = new Date();
    const result = await usersCollection.updateMany(
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
          tenantId: targetTenant.tenantId,
          updatedAt: now,
        },
      }
    );

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migration completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Assigned ${result.modifiedCount} user(s) to tenant: ${targetTenant.tenantId}`);
    console.log(`   Target tenant: ${targetTenant.name || targetTenant.tenantId}`);
    console.log(`   Total users in target tenant: ${await usersCollection.countDocuments({ tenantId: targetTenant.tenantId })}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if executed directly
if (require.main === module) {
  runMigration();
}

export { runMigration };

