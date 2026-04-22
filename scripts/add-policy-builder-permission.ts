/**
 * Script to add policies.builder.view permission to users who have other policy permissions
 * Run: npx tsx scripts/add-policy-builder-permission.ts
 */

import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hospital_ops';

async function addPolicyBuilderPermission() {
  let client: MongoClient | null = null;

  try {
    console.log('🔗 Connecting to MongoDB...');
    client = new MongoClient(MONGO_URL);
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(DB_NAME);
    const usersCollection = db.collection('users');

    // Find users who have policy-related permissions but not policies.builder.view
    const policyPermissions = [
      'policies.view',
      'policies.upload.view',
      'policies.conflicts.view',
      'policies.assistant.view',
      'policies.new-creator.view',
      'policies.harmonization.view',
      'policies.risk-detector.view',
      'policies.tag-review.view',
    ];

    const users = await usersCollection
      .find({
        $or: [
          { permissions: { $in: policyPermissions } },
          { role: 'admin' },
          { role: 'thea-owner' },
        ],
        isActive: true,
      })
      .toArray();

    console.log(`📋 Found ${users.length} users with policy permissions\n`);

    let updatedCount = 0;

    for (const user of users) {
      const currentPermissions = user.permissions || [];
      
      // Skip if user already has the permission
      if (currentPermissions.includes('policies.builder.view')) {
        console.log(`⏭️  Skipping ${user.email} - already has policies.builder.view`);
        continue;
      }

      // Add the permission
      const newPermissions = [...currentPermissions, 'policies.builder.view'];
      
      const result = await usersCollection.updateOne(
        { _id: user._id },
        {
          $set: {
            permissions: newPermissions,
            updatedAt: new Date(),
          },
        }
      );

      if (result.modifiedCount === 1) {
        updatedCount++;
        console.log(`✅ Added policies.builder.view to ${user.email} (${user.role})`);
      } else {
        console.log(`⚠️  Failed to update ${user.email}`);
      }
    }

    console.log(`\n✨ Done! Updated ${updatedCount} users`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

// Run the script
addPolicyBuilderPermission();
