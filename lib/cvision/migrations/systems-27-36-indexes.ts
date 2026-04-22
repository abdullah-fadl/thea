import { logger } from '@/lib/monitoring/logger';
/**
 * MongoDB Indexes for Systems 27-36 (Infrastructure)
 *
 * Run: npx ts-node lib/cvision/migrations/systems-27-36-indexes.ts
 */

import { Db } from '@/lib/cvision/infra/mongo-compat';

export async function createSystems27to36Indexes(db: Db) {
  // System 27: Global Search
  await db.collection('cvision_search_index').createIndex({ tenantId: 1, searchText: 'text' });

  // System 28: Bulk Operations
  await db.collection('cvision_bulk_operations').createIndex({ tenantId: 1, status: 1, startedAt: -1 });

  // System 29: File Management
  await db.collection('cvision_files').createIndex({ tenantId: 1, module: 1, resourceId: 1 });

  // System 30: Custom Dashboards
  await db.collection('cvision_dashboards').createIndex({ tenantId: 1, ownerId: 1 });

  // System 31: Webhooks
  await db.collection('cvision_webhook_subscriptions').createIndex({ tenantId: 1, events: 1, isActive: 1 });
  await db.collection('cvision_webhook_deliveries').createIndex({ tenantId: 1, webhookId: 1, createdAt: -1 });

  // System 32: Reports
  await db.collection('cvision_saved_reports').createIndex({ tenantId: 1, createdBy: 1 });
  await db.collection('cvision_report_schedules').createIndex({ tenantId: 1, isActive: 1, nextRun: 1 });

  // System 33: Undo/Redo + Soft Delete
  await db.collection('cvision_undo_stack').createIndex({ tenantId: 1, userId: 1, createdAt: -1 });
  await db.collection('cvision_undo_stack').createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 });
  await db.collection('cvision_deleted_records').createIndex({ tenantId: 1, originalCollection: 1 });
  await db.collection('cvision_deleted_records').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  // System 34: Table Preferences
  await db.collection('cvision_table_preferences').createIndex({ tenantId: 1, userId: 1, tableId: 1 }, { unique: true });

  // System 35: Headcount Budget
  await db.collection('cvision_headcount_budget').createIndex({ tenantId: 1, year: 1 });
  await db.collection('cvision_headcount_budget').createIndex({ tenantId: 1, departmentId: 1, year: 1 }, { unique: true });

  // System 36: Branches
  await db.collection('cvision_branches').createIndex({ tenantId: 1, isActive: 1 });
  await db.collection('cvision_branches').createIndex({ tenantId: 1, code: 1 }, { unique: true, sparse: true });

  logger.info('[Migration] Systems 27-36 indexes created successfully');
}
