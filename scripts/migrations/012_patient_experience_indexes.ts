/**
 * Migration 012: Patient Experience Performance Indexes
 * 
 * Creates indexes on patient_experience and px_cases collections
 * to improve query performance for dashboard and analytics.
 * 
 * Usage:
 *   npx tsx scripts/migrations/012_patient_experience_indexes.ts
 */

import { getCollection } from '../../lib/db';

async function runMigration() {
  try {
    console.log('🚀 Starting Patient Experience indexes migration...\n');

    // Patient Experience collection indexes
    console.log('📊 Creating indexes for patient_experience...');
    const patientExperienceCollection = await getCollection('patient_experience');
    
    // Primary indexes
    await patientExperienceCollection.createIndex({ id: 1 }, { unique: true });
    await patientExperienceCollection.createIndex({ tenantId: 1 });
    
    // Date indexes (most common queries)
    await patientExperienceCollection.createIndex({ visitDate: -1 });
    await patientExperienceCollection.createIndex({ createdAt: -1 });
    
    // Composite indexes for common query patterns
    await patientExperienceCollection.createIndex({ tenantId: 1, visitDate: -1 });
    await patientExperienceCollection.createIndex({ tenantId: 1, createdAt: -1 });
    await patientExperienceCollection.createIndex({ tenantId: 1, status: 1, visitDate: -1 });
    
    // Location indexes
    await patientExperienceCollection.createIndex({ tenantId: 1, floorKey: 1, visitDate: -1 });
    await patientExperienceCollection.createIndex({ tenantId: 1, departmentKey: 1, visitDate: -1 });
    await patientExperienceCollection.createIndex({ tenantId: 1, roomKey: 1, visitDate: -1 });
    
    // Staff and type indexes
    await patientExperienceCollection.createIndex({ tenantId: 1, staffId: 1, visitDate: -1 });
    await patientExperienceCollection.createIndex({ tenantId: 1, severity: 1, visitDate: -1 });
    await patientExperienceCollection.createIndex({ tenantId: 1, domainKey: 1, visitDate: -1 });
    await patientExperienceCollection.createIndex({ tenantId: 1, typeKey: 1, visitDate: -1 });
    
    // Date range queries (for analytics)
    await patientExperienceCollection.createIndex({ 
      tenantId: 1, 
      visitDate: 1, 
      floorKey: 1, 
      departmentKey: 1 
    });
    
    console.log('✅ patient_experience indexes created\n');

    // PX Cases collection indexes
    console.log('📊 Creating indexes for px_cases...');
    const casesCollection = await getCollection('px_cases');
    
    // Primary indexes
    await casesCollection.createIndex({ id: 1 }, { unique: true });
    await casesCollection.createIndex({ tenantId: 1 });
    await casesCollection.createIndex({ visitId: 1 });
    
    // Status and date indexes
    await casesCollection.createIndex({ tenantId: 1, status: 1, createdAt: -1 });
    await casesCollection.createIndex({ tenantId: 1, active: 1, status: 1 });
    await casesCollection.createIndex({ tenantId: 1, dueAt: 1 });
    
    // Composite indexes for common queries
    await casesCollection.createIndex({ tenantId: 1, visitId: 1, active: 1 });
    await casesCollection.createIndex({ tenantId: 1, severity: 1, status: 1, dueAt: 1 });
    await casesCollection.createIndex({ tenantId: 1, status: 1, dueAt: 1 });
    
    // Overdue cases queries
    await casesCollection.createIndex({ 
      tenantId: 1, 
      active: 1, 
      status: 1, 
      dueAt: 1 
    });
    
    // Resolution time queries
    await casesCollection.createIndex({ tenantId: 1, status: 1, resolvedAt: 1 });
    await casesCollection.createIndex({ tenantId: 1, createdAt: 1, resolvedAt: 1 });
    
    console.log('✅ px_cases indexes created\n');

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if executed directly
if (require.main === module) {
  runMigration();
}

export { runMigration };

