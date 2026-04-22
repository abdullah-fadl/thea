/**
 * Migration: Hierarchical User Management
 * 
 * Creates indexes for groups, hospitals, and updates user indexes
 * Run with: npx tsx scripts/migrations/002_hierarchical_user_management.ts
 */

import { MongoClient } from 'mongodb';
// Note: This script should be run with ts-node or compiled separately
// Environment variables are loaded by the runtime (Node.js or tsx)

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'hospital_ops';

async function runMigration() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DB_NAME);

    // Create indexes for groups collection
    console.log('Creating indexes for groups collection...');
    const groupsCollection = db.collection('groups');
    await groupsCollection.createIndex({ id: 1 }, { unique: true });
    await groupsCollection.createIndex({ code: 1, tenantId: 1 }, { unique: true });
    await groupsCollection.createIndex({ tenantId: 1 });
    await groupsCollection.createIndex({ isActive: 1 });
    console.log('✓ Groups indexes created');

    // Create indexes for hospitals collection
    console.log('Creating indexes for hospitals collection...');
    const hospitalsCollection = db.collection('hospitals');
    await hospitalsCollection.createIndex({ id: 1 }, { unique: true });
    await hospitalsCollection.createIndex({ code: 1, groupId: 1 }, { unique: true });
    await hospitalsCollection.createIndex({ groupId: 1 });
    await hospitalsCollection.createIndex({ tenantId: 1 });
    await hospitalsCollection.createIndex({ isActive: 1 });
    console.log('✓ Hospitals indexes created');

    // Update indexes for users collection
    console.log('Creating/updating indexes for users collection...');
    const usersCollection = db.collection('users');
    await usersCollection.createIndex({ groupId: 1 });
    await usersCollection.createIndex({ hospitalId: 1 });
    await usersCollection.createIndex({ groupId: 1, hospitalId: 1 });
    await usersCollection.createIndex({ tenantId: 1 });
    await usersCollection.createIndex({ email: 1, tenantId: 1 }, { unique: true, sparse: true });
    console.log('✓ Users indexes created/updated');

    console.log('\n✅ Migration completed successfully!');
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

