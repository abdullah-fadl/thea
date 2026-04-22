/**
 * Migration 001: Core EHR Indexes
 * 
 * Creates indexes for core EHR collections.
 * 
 * Usage:
 *   npx tsx scripts/migrations/001_core_indexes.ts
 * 
 * Or with environment variables:
 *   MONGO_URL=... DB_NAME=... npx tsx scripts/migrations/001_core_indexes.ts
 */

import { connectDB } from '../../lib/db';

async function createIndexes() {
  try {
    const db = await connectDB();
    console.log('✅ Connected to MongoDB');

    // Patients collection indexes
    console.log('\n📊 Creating indexes for ehr_patients...');
    const patientsCollection = db.collection('ehr_patients');
    await patientsCollection.createIndex({ id: 1 }, { unique: true });
    await patientsCollection.createIndex({ mrn: 1 }, { unique: true });
    await patientsCollection.createIndex({ lastName: 1, firstName: 1 });
    await patientsCollection.createIndex({ dateOfBirth: 1 });
    await patientsCollection.createIndex({ nationalId: 1 }, { sparse: true });
    await patientsCollection.createIndex({ isActive: 1, createdAt: -1 });
    console.log('✅ ehr_patients indexes created');

    // Encounters collection indexes
    console.log('\n📊 Creating indexes for ehr_encounters...');
    const encountersCollection = db.collection('ehr_encounters');
    await encountersCollection.createIndex({ id: 1 }, { unique: true });
    await encountersCollection.createIndex({ encounterNumber: 1 }, { unique: true });
    await encountersCollection.createIndex({ patientId: 1, createdAt: -1 });
    await encountersCollection.createIndex({ mrn: 1, createdAt: -1 });
    await encountersCollection.createIndex({ status: 1, admissionDate: -1 });
    await encountersCollection.createIndex({ encounterType: 1, admissionDate: -1 });
    await encountersCollection.createIndex({ attendingPhysicianId: 1, admissionDate: -1 }, { sparse: true });
    await encountersCollection.createIndex({ department: 1, admissionDate: -1 }, { sparse: true });
    console.log('✅ ehr_encounters indexes created');

    // Users collection indexes
    console.log('\n📊 Creating indexes for ehr_users...');
    const usersCollection = db.collection('ehr_users');
    await usersCollection.createIndex({ id: 1 }, { unique: true });
    await usersCollection.createIndex({ userId: 1 }, { unique: true });
    await usersCollection.createIndex({ email: 1 });
    await usersCollection.createIndex({ isActive: 1 });
    await usersCollection.createIndex({ department: 1 }, { sparse: true });
    await usersCollection.createIndex({ licenseNumber: 1 }, { sparse: true, unique: true });
    await usersCollection.createIndex({ npi: 1 }, { sparse: true, unique: true });
    console.log('✅ ehr_users indexes created');

    // Privileges collection indexes
    console.log('\n📊 Creating indexes for ehr_privileges...');
    const privilegesCollection = db.collection('ehr_privileges');
    await privilegesCollection.createIndex({ id: 1 }, { unique: true });
    await privilegesCollection.createIndex({ userId: 1, resource: 1, action: 1 });
    await privilegesCollection.createIndex({ userId: 1, isActive: 1 });
    await privilegesCollection.createIndex({ resource: 1, action: 1 });
    await privilegesCollection.createIndex({ departmentId: 1 }, { sparse: true });
    await privilegesCollection.createIndex({ expiresAt: 1 }, { sparse: true });
    console.log('✅ ehr_privileges indexes created');

    // Orders collection indexes
    console.log('\n📊 Creating indexes for ehr_orders...');
    const ordersCollection = db.collection('ehr_orders');
    await ordersCollection.createIndex({ id: 1 }, { unique: true });
    await ordersCollection.createIndex({ orderNumber: 1 }, { unique: true });
    await ordersCollection.createIndex({ patientId: 1, orderedAt: -1 });
    await ordersCollection.createIndex({ mrn: 1, orderedAt: -1 });
    await ordersCollection.createIndex({ encounterId: 1, orderedAt: -1 }, { sparse: true });
    await ordersCollection.createIndex({ status: 1, orderedAt: -1 });
    await ordersCollection.createIndex({ orderType: 1, orderedAt: -1 });
    await ordersCollection.createIndex({ orderedBy: 1, orderedAt: -1 });
    await ordersCollection.createIndex({ scheduledTime: 1 }, { sparse: true });
    console.log('✅ ehr_orders indexes created');

    // Tasks collection indexes
    console.log('\n📊 Creating indexes for ehr_tasks...');
    const tasksCollection = db.collection('ehr_tasks');
    await tasksCollection.createIndex({ id: 1 }, { unique: true });
    await tasksCollection.createIndex({ patientId: 1, createdAt: -1 }, { sparse: true });
    await tasksCollection.createIndex({ encounterId: 1, createdAt: -1 }, { sparse: true });
    await tasksCollection.createIndex({ orderId: 1, createdAt: -1 }, { sparse: true });
    await tasksCollection.createIndex({ assignedTo: 1, status: 1, dueDate: 1 });
    await tasksCollection.createIndex({ status: 1, priority: 1, dueDate: 1 });
    await tasksCollection.createIndex({ department: 1, status: 1 }, { sparse: true });
    await tasksCollection.createIndex({ mrn: 1, createdAt: -1 }, { sparse: true });
    console.log('✅ ehr_tasks indexes created');

    // Notes collection indexes
    console.log('\n📊 Creating indexes for ehr_notes...');
    const notesCollection = db.collection('ehr_notes');
    await notesCollection.createIndex({ id: 1 }, { unique: true });
    await notesCollection.createIndex({ patientId: 1, authoredAt: -1 });
    await notesCollection.createIndex({ mrn: 1, authoredAt: -1 });
    await notesCollection.createIndex({ encounterId: 1, authoredAt: -1 }, { sparse: true });
    await notesCollection.createIndex({ authoredBy: 1, authoredAt: -1 });
    await notesCollection.createIndex({ noteType: 1, authoredAt: -1 });
    await notesCollection.createIndex({ status: 1, authoredAt: -1 });
    await notesCollection.createIndex({ content: 'text' }); // Text search index
    console.log('✅ ehr_notes indexes created');

    // Audit logs collection indexes
    console.log('\n📊 Creating indexes for ehr_audit_logs...');
    const auditLogsCollection = db.collection('ehr_audit_logs');
    await auditLogsCollection.createIndex({ id: 1 }, { unique: true });
    await auditLogsCollection.createIndex({ timestamp: -1 });
    await auditLogsCollection.createIndex({ userId: 1, timestamp: -1 });
    await auditLogsCollection.createIndex({ resourceType: 1, resourceId: 1, timestamp: -1 });
    await auditLogsCollection.createIndex({ patientId: 1, timestamp: -1 }, { sparse: true });
    await auditLogsCollection.createIndex({ mrn: 1, timestamp: -1 }, { sparse: true });
    await auditLogsCollection.createIndex({ action: 1, timestamp: -1 });
    await auditLogsCollection.createIndex({ requestId: 1 }, { sparse: true });
    console.log('✅ ehr_audit_logs indexes created');

    console.log('\n✅ All EHR core indexes created successfully!');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  createIndexes()
    .then(() => {
      console.log('\n✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export { createIndexes };

