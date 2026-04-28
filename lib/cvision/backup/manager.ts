import type { Db } from '@/lib/cvision/infra/mongo-compat';

/**
 * Backup & Disaster Recovery Manager
 *
 * Provides logical (collection-level) backup/restore via MongoDB
 * without shelling out to mongodump. Suitable for Render / serverless.
 * For large-scale deployments, use MongoDB Atlas automated backups.
 */

const BACKUP_LOGS = 'cvision_backup_logs';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface BackupLog {
  _id?: any;
  type: 'DATABASE' | 'FILES' | 'FULL';
  timestamp: Date;
  sizeEstimate: number;
  collections: { name: string; count: number }[];
  status: 'SUCCESS' | 'FAILED';
  error?: string;
  durationMs: number;
}

/* ── Logical Backup (JSON export to collection) ────────────────────── */

export async function performBackup(db: Db, tenantId: string): Promise<BackupLog> {
  const start = Date.now();
  const timestamp = new Date();
  const backupId = `BK-${timestamp.toISOString().replace(/[:.]/g, '-')}`;

  try {
    const allCollections = await db.listCollections().toArray();
    const cvisionCollections = allCollections.filter(c => c.name.startsWith('cvision_') && !c.name.includes('_backup'));
    const results: { name: string; count: number }[] = [];
    let totalDocs = 0;

    for (const col of cvisionCollections) {
      const docs = await db.collection(col.name).find({ tenantId }).toArray();
      if (docs.length === 0) continue;

      await db.collection('cvision_backup_snapshots').insertOne({
        backupId,
        tenantId,
        collection: col.name,
        data: docs,
        timestamp,
      });

      results.push({ name: col.name, count: docs.length });
      totalDocs += docs.length;
    }

    const log: BackupLog = {
      type: 'DATABASE',
      timestamp,
      sizeEstimate: totalDocs,
      collections: results,
      status: 'SUCCESS',
      durationMs: Date.now() - start,
    };

    await db.collection(BACKUP_LOGS).insertOne({ ...log, tenantId, backupId });
    return log;
  } catch (err: any) {
    const log: BackupLog = {
      type: 'DATABASE',
      timestamp,
      sizeEstimate: 0,
      collections: [],
      status: 'FAILED',
      error: err.message,
      durationMs: Date.now() - start,
    };
    await db.collection(BACKUP_LOGS).insertOne({ ...log, tenantId, backupId });
    return log;
  }
}

/* ── Restore ───────────────────────────────────────────────────────── */

export async function restoreBackup(db: Db, tenantId: string, backupId: string): Promise<{ restored: number; collections: string[] }> {
  const snapshots = await db.collection('cvision_backup_snapshots').find({ tenantId, backupId }).toArray();
  if (snapshots.length === 0) throw new Error(`No backup found with ID: ${backupId}`);

  let restored = 0;
  const collections: string[] = [];

  for (const snap of snapshots) {
    // Clear current data in the collection for this tenant
    await db.collection(snap.collection).deleteMany({ tenantId });
    // Insert backed-up data
    if (snap.data?.length > 0) {
      await db.collection(snap.collection).insertMany(snap.data);
      restored += snap.data.length;
      collections.push(snap.collection);
    }
  }

  await db.collection(BACKUP_LOGS).insertOne({
    tenantId, backupId,
    type: 'DATABASE',
    timestamp: new Date(),
    sizeEstimate: restored,
    collections: collections.map(c => ({ name: c, count: 0 })),
    status: 'SUCCESS',
    durationMs: 0,
    action: 'RESTORE',
  });

  return { restored, collections };
}

/* ── List Backups ──────────────────────────────────────────────────── */

export async function listBackups(db: Db, tenantId: string, limit = 20) {
  return db.collection(BACKUP_LOGS).find({ tenantId, action: { $ne: 'RESTORE' } })
    .sort({ timestamp: -1 }).limit(limit).toArray();
}

export async function getBackupDetail(db: Db, tenantId: string, backupId: string) {
  const log = await db.collection(BACKUP_LOGS).findOne({ tenantId, backupId });
  const snapshots = await db.collection('cvision_backup_snapshots').find(
    { tenantId, backupId },
    { projection: { collection: 1, 'data.length': 1 } },
  ).toArray();
  return { log, snapshotCount: snapshots.length };
}

/* ── Cleanup Old Backups ───────────────────────────────────────────── */

export async function cleanupOldBackups(db: Db, tenantId: string, keepCount = 10) {
  const backups = await db.collection(BACKUP_LOGS).find({ tenantId, action: { $ne: 'RESTORE' } })
    .sort({ timestamp: -1 }).skip(keepCount).toArray();

  let removed = 0;
  for (const backup of backups) {
    if (backup.backupId) {
      await db.collection('cvision_backup_snapshots').deleteMany({ tenantId, backupId: backup.backupId });
      await db.collection(BACKUP_LOGS).deleteOne({ _id: backup._id, tenantId });
      removed++;
    }
  }
  return { removed };
}

/* ── Storage Usage ─────────────────────────────────────────────────── */

export async function getStorageUsage(db: Db, tenantId: string) {
  const allCollections = await db.listCollections().toArray();
  const cvision = allCollections.filter(c => c.name.startsWith('cvision_'));
  const stats: { collection: string; count: number }[] = [];

  for (const col of cvision) {
    const count = await db.collection(col.name).countDocuments({ tenantId });
    if (count > 0) stats.push({ collection: col.name, count });
  }

  stats.sort((a, b) => b.count - a.count);
  const totalDocs = stats.reduce((s, c) => s + c.count, 0);
  return { totalDocuments: totalDocs, collections: stats };
}
