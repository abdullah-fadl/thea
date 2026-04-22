/**
 * Migration: CVision Prisma Models
 * 
 * Creates CVision collections with proper indexes.
 * This migration ensures all CVision models are properly set up in tenant databases.
 * 
 * Run: dotenv -e .env.local -- tsx scripts/migrations/034_cvision_prisma_models.ts
 */

import { MongoClient } from 'mongodb';
import { env } from '@/lib/env';
import { getTenantDbByKey } from '@/lib/db/tenantDb';

async function createCVisionIndexes(db: any, tenantId: string) {
  console.log(`[CVision Migration] Creating indexes for tenant: ${tenantId}`);

  // CvisionDepartment indexes
  await db.collection('cvision_departments').createIndexes([
    { key: { tenantId: 1, code: 1 }, unique: true, name: 'tenant_code_unique' },
    { key: { tenantId: 1 }, name: 'tenant_idx' },
    { key: { tenantId: 1, isArchived: 1 }, name: 'tenant_archived_idx' },
  ]);

  // CvisionUnit indexes
  await db.collection('cvision_units').createIndexes([
    { key: { tenantId: 1, departmentId: 1, code: 1 }, unique: true, name: 'tenant_dept_code_unique' },
    { key: { tenantId: 1 }, name: 'tenant_idx' },
    { key: { departmentId: 1 }, name: 'department_idx' },
  ]);

  // CvisionGrade indexes
  await db.collection('cvision_grades').createIndexes([
    { key: { tenantId: 1, code: 1 }, unique: true, name: 'tenant_code_unique' },
    { key: { tenantId: 1 }, name: 'tenant_idx' },
    { key: { tenantId: 1, level: 1 }, name: 'tenant_level_idx' },
  ]);

  // CvisionJobTitle indexes
  await db.collection('cvision_job_titles').createIndexes([
    { key: { tenantId: 1, code: 1 }, unique: true, name: 'tenant_code_unique' },
    { key: { tenantId: 1 }, name: 'tenant_idx' },
    { key: { departmentId: 1 }, name: 'department_idx' },
  ]);

  // CvisionEmployee indexes
  await db.collection('cvision_employees').createIndexes([
    { key: { tenantId: 1, employeeNo: 1 }, unique: true, name: 'tenant_employeeNo_unique' },
    { key: { tenantId: 1, email: 1 }, unique: true, sparse: true, name: 'tenant_email_unique' },
    { key: { tenantId: 1 }, name: 'tenant_idx' },
    { key: { tenantId: 1, status: 1 }, name: 'tenant_status_idx' },
    { key: { departmentId: 1 }, name: 'department_idx' },
    { key: { managerEmployeeId: 1 }, name: 'manager_idx' },
  ]);

  // CvisionEmployeeStatusHistory indexes
  await db.collection('cvision_employee_status_history').createIndexes([
    { key: { tenantId: 1 }, name: 'tenant_idx' },
    { key: { employeeId: 1 }, name: 'employee_idx' },
    { key: { tenantId: 1, employeeId: 1, effectiveDate: -1 }, name: 'tenant_employee_date_idx' },
  ]);

  // CvisionProfileSchema indexes
  await db.collection('cvision_profile_schemas').createIndexes([
    { key: { tenantId: 1, version: 1 }, unique: true, name: 'tenant_version_unique' },
    { key: { tenantId: 1 }, name: 'tenant_idx' },
    { key: { tenantId: 1, isActive: 1 }, name: 'tenant_active_idx' },
    { key: { tenantId: 1, isArchived: 1 }, name: 'tenant_archived_idx' },
  ]);

  // CvisionEmployeeProfileValue indexes
  await db.collection('cvision_employee_profile_values').createIndexes([
    { key: { tenantId: 1, employeeId: 1, schemaVersion: 1 }, unique: true, name: 'tenant_employee_version_unique' },
    { key: { tenantId: 1 }, name: 'tenant_idx' },
    { key: { tenantId: 1, employeeId: 1 }, name: 'tenant_employee_idx' },
    { key: { tenantId: 1, schemaId: 1 }, name: 'tenant_schema_idx' },
    { key: { tenantId: 1, schemaVersion: 1 }, name: 'tenant_version_idx' },
  ]);

  // CvisionAuditLog indexes
  await db.collection('cvision_audit_logs').createIndexes([
    { key: { tenantId: 1 }, name: 'tenant_idx' },
    { key: { tenantId: 1, entityType: 1, entityId: 1 }, name: 'tenant_entity_idx' },
    { key: { tenantId: 1, actorUserId: 1 }, name: 'tenant_actor_idx' },
    { key: { tenantId: 1, action: 1 }, name: 'tenant_action_idx' },
    { key: { createdAt: -1 }, name: 'created_idx' },
  ]);

  console.log(`[CVision Migration] ✅ Indexes created for tenant: ${tenantId}`);
}

async function main() {
  const tenantId = process.env.TENANT_ID || 'tenant1';
  
  try {
    console.log(`[CVision Migration] Starting migration for tenant: ${tenantId}`);
    
    const db = await getTenantDbByKey(tenantId);
    await createCVisionIndexes(db, tenantId);
    
    console.log(`[CVision Migration] ✅ Migration completed successfully`);
  } catch (error) {
    console.error('[CVision Migration] ❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { createCVisionIndexes };
