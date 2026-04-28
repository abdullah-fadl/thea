/**
 * Script to grant all permissions to admin@hospital.com user
 * Run with: npx ts-node scripts/grant-all-permissions-to-admin.ts
 */

import { MongoClient } from 'mongodb';
// Note: This script should be run with ts-node or tsx
// Environment variables are loaded by the runtime (Node.js/tsx)

// Import PERMISSIONS - we'll define it inline to avoid module resolution issues
const PERMISSIONS = [
  { key: 'dashboard.view' },
  { key: 'notifications.view' },
  { key: 'opd.dashboard.view' },
  { key: 'scheduling.view' },
  { key: 'scheduling.create' },
  { key: 'scheduling.edit' },
  { key: 'scheduling.delete' },
  { key: 'scheduling.availability.view' },
  { key: 'scheduling.availability.create' },
  { key: 'scheduling.availability.edit' },
  { key: 'scheduling.availability.delete' },
  { key: 'er.register.view' },
  { key: 'er.register.create' },
  { key: 'er.register.edit' },
  { key: 'er.register.delete' },
  { key: 'er.triage.view' },
  { key: 'er.triage.create' },
  { key: 'er.triage.edit' },
  { key: 'er.triage.delete' },
  { key: 'er.disposition.view' },
  { key: 'er.disposition.create' },
  { key: 'er.disposition.edit' },
  { key: 'er.disposition.delete' },
  { key: 'er.progress-note.view' },
  { key: 'er.progress-note.create' },
  { key: 'er.progress-note.edit' },
  { key: 'er.progress-note.delete' },
  { key: 'px.dashboard.view' },
  { key: 'px.dashboard.create' },
  { key: 'px.dashboard.edit' },
  { key: 'px.dashboard.delete' },
  { key: 'px.analytics.view' },
  { key: 'px.analytics.create' },
  { key: 'px.analytics.edit' },
  { key: 'px.analytics.delete' },
  { key: 'px.reports.view' },
  { key: 'px.reports.create' },
  { key: 'px.reports.edit' },
  { key: 'px.reports.delete' },
  { key: 'px.visits.view' },
  { key: 'px.visits.create' },
  { key: 'px.visits.edit' },
  { key: 'px.visits.delete' },
  { key: 'px.cases.view' },
  { key: 'px.cases.create' },
  { key: 'px.cases.edit' },
  { key: 'px.cases.delete' },
  { key: 'px.setup.view' },
  { key: 'px.setup.create' },
  { key: 'px.setup.edit' },
  { key: 'px.setup.delete' },
  { key: 'px.seed-data.view' },
  { key: 'px.seed-data.create' },
  { key: 'px.seed-data.edit' },
  { key: 'px.seed-data.delete' },
  { key: 'px.delete-data.view' },
  { key: 'px.delete-data.create' },
  { key: 'px.delete-data.edit' },
  { key: 'px.delete-data.delete' },
  { key: 'ipd.bed-setup.view' },
  { key: 'ipd.bed-setup.create' },
  { key: 'ipd.bed-setup.edit' },
  { key: 'ipd.bed-setup.delete' },
  { key: 'ipd.live-beds.view' },
  { key: 'ipd.live-beds.create' },
  { key: 'ipd.live-beds.edit' },
  { key: 'ipd.live-beds.delete' },
  { key: 'ipd.dept-input.view' },
  { key: 'ipd.dept-input.create' },
  { key: 'ipd.dept-input.edit' },
  { key: 'ipd.dept-input.delete' },
  { key: 'equipment.opd.master.view' },
  { key: 'equipment.opd.master.create' },
  { key: 'equipment.opd.master.edit' },
  { key: 'equipment.opd.master.delete' },
  { key: 'equipment.opd.clinic-map.view' },
  { key: 'equipment.opd.clinic-map.create' },
  { key: 'equipment.opd.clinic-map.edit' },
  { key: 'equipment.opd.clinic-map.delete' },
  { key: 'equipment.opd.checklist.view' },
  { key: 'equipment.opd.checklist.create' },
  { key: 'equipment.opd.checklist.edit' },
  { key: 'equipment.opd.checklist.delete' },
  { key: 'equipment.opd.movements.view' },
  { key: 'equipment.opd.movements.create' },
  { key: 'equipment.opd.movements.edit' },
  { key: 'equipment.opd.movements.delete' },
  { key: 'equipment.ipd.map.view' },
  { key: 'equipment.ipd.map.create' },
  { key: 'equipment.ipd.map.edit' },
  { key: 'equipment.ipd.map.delete' },
  { key: 'equipment.ipd.checklist.view' },
  { key: 'equipment.ipd.checklist.create' },
  { key: 'equipment.ipd.checklist.edit' },
  { key: 'equipment.ipd.checklist.delete' },
  { key: 'manpower.overview.view' },
  { key: 'manpower.overview.create' },
  { key: 'manpower.overview.edit' },
  { key: 'manpower.overview.delete' },
  { key: 'manpower.edit.view' },
  { key: 'manpower.edit.create' },
  { key: 'manpower.edit.edit' },
  { key: 'manpower.edit.delete' },
  { key: 'nursing.scheduling.view' },
  { key: 'nursing.scheduling.create' },
  { key: 'nursing.scheduling.edit' },
  { key: 'nursing.scheduling.delete' },
  { key: 'nursing.operations.view' },
  { key: 'nursing.operations.create' },
  { key: 'nursing.operations.edit' },
  { key: 'nursing.operations.delete' },
  { key: 'policies.upload.view' },
  { key: 'policies.upload.create' },
  { key: 'policies.upload.edit' },
  { key: 'policies.upload.delete' },
  { key: 'policies.view' },
  { key: 'policies.create' },
  { key: 'policies.edit' },
  { key: 'policies.delete' },
  { key: 'policies.conflicts.view' },
  { key: 'policies.assistant.view' },
  { key: 'policies.assistant.create' },
  { key: 'policies.assistant.edit' },
  { key: 'policies.assistant.delete' },
  { key: 'policies.new-creator.view' },
  { key: 'policies.new-creator.create' },
  { key: 'policies.new-creator.edit' },
  { key: 'policies.new-creator.delete' },
  { key: 'policies.harmonization.view' },
  { key: 'policies.harmonization.create' },
  { key: 'policies.harmonization.edit' },
  { key: 'policies.harmonization.delete' },
  { key: 'admin.data-admin.view' },
  { key: 'admin.data-admin.create' },
  { key: 'admin.data-admin.edit' },
  { key: 'admin.data-admin.delete' },
  { key: 'admin.groups-hospitals.view' },
  { key: 'admin.groups-hospitals.create' },
  { key: 'admin.groups-hospitals.edit' },
  { key: 'admin.groups-hospitals.delete' },
  { key: 'admin.users.view' },
  { key: 'admin.users.create' },
  { key: 'admin.users.edit' },
  { key: 'admin.users.delete' },
  { key: 'admin.quotas.view' },
  { key: 'admin.quotas.create' },
  { key: 'admin.quotas.edit' },
  { key: 'admin.quotas.delete' },
  { key: 'admin.structure-management.view' },
  { key: 'admin.structure-management.create' },
  { key: 'admin.structure-management.edit' },
  { key: 'admin.structure-management.delete' },
  { key: 'admin.delete-sample-data.view' },
  { key: 'admin.delete-sample-data.create' },
  { key: 'admin.delete-sample-data.edit' },
  { key: 'admin.delete-sample-data.delete' },
  { key: 'account.view' },
  { key: 'account.edit' },
];

// Environment variables are loaded by the runtime (Node.js/tsx)

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hospital_ops';
const ADMIN_EMAIL = 'admin@hospital.com';

async function grantAllPermissions() {
  let client: MongoClient | null = null;

  try {
    console.log('Connecting to MongoDB...');
    client = new MongoClient(MONGO_URL);
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DB_NAME);
    const usersCollection = db.collection('users');

    // Get all permission keys
    const allPermissions = PERMISSIONS.map(p => p.key);
    console.log(`\nTotal permissions found: ${allPermissions.length}`);
    console.log('Permissions:', allPermissions);

    // Find the admin user
    const adminUser = await usersCollection.findOne({ email: ADMIN_EMAIL });

    if (!adminUser) {
      console.error(`\n❌ Error: User with email "${ADMIN_EMAIL}" not found!`);
      process.exit(1);
    }

    console.log(`\n✓ Found user: ${adminUser.firstName} ${adminUser.lastName} (${adminUser.email})`);
    console.log(`Current role: ${adminUser.role}`);
    console.log(`Current permissions count: ${adminUser.permissions?.length || 0}`);

    // Update user with all permissions
    const result = await usersCollection.updateOne(
      { email: ADMIN_EMAIL },
      {
        $set: {
          permissions: allPermissions,
          role: 'admin', // Ensure role is admin
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount === 1) {
      console.log(`\n✅ Successfully granted all ${allPermissions.length} permissions to ${ADMIN_EMAIL}`);
      console.log('User role set to: admin');
      
      // Verify the update
      const updatedUser = await usersCollection.findOne(
        { email: ADMIN_EMAIL },
        { projection: { password: 0 } }
      );
      
      if (updatedUser) {
        console.log(`\n✓ Verification: User now has ${updatedUser.permissions?.length || 0} permissions`);
        console.log('All permissions granted successfully!');
      }
    } else if (result.matchedCount === 0) {
      console.error(`\n❌ Error: User with email "${ADMIN_EMAIL}" not found!`);
      process.exit(1);
    } else {
      console.log('\n⚠️  User was found but no changes were made (permissions may already be set)');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n✓ Database connection closed');
    }
  }
}

// Run the script
grantAllPermissions()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
