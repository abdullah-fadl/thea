import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export type FileCategory =
  | 'NATIONAL_ID' | 'PASSPORT' | 'CERTIFICATE' | 'CONTRACT' | 'LETTER'
  | 'PHOTO' | 'CV' | 'MEDICAL' | 'INSURANCE' | 'LICENSE' | 'OTHER';

export type AccessLevel = 'PUBLIC' | 'INTERNAL' | 'RESTRICTED' | 'CONFIDENTIAL';
export type ScanStatus = 'PENDING' | 'CLEAN' | 'INFECTED';

const FILES_COLL = 'cvision_files';

export const STORAGE_QUOTAS = {
  perTenant: 50 * 1024 * 1024 * 1024,  // 50 GB
  perFile: 50 * 1024 * 1024,            // 50 MB
  allowedTypes: [
    'application/pdf',
    'image/jpeg', 'image/png', 'image/gif',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ],
};

/* ── Seed ──────────────────────────────────────────────────────────── */

export async function ensureSeedData(db: Db, tenantId: string) {
  const coll = db.collection(FILES_COLL);
  if (await coll.countDocuments({ tenantId }) > 0) return;

  const now = new Date();
  await coll.insertMany([
    {
      tenantId, fileId: 'FILE-001', fileName: 'ahmed_ali_national_id.pdf', originalName: 'National ID - Ahmed Ali.pdf',
      mimeType: 'application/pdf', size: 245000, extension: 'pdf',
      storageProvider: 'LOCAL', storagePath: '/uploads/emp/ahmed_ali_national_id.pdf', storageUrl: '/uploads/emp/ahmed_ali_national_id.pdf',
      module: 'employees', recordId: 'EMP-001', recordName: 'Ahmed Ali',
      category: 'NATIONAL_ID' as FileCategory, description: 'National ID front and back',
      tags: ['id', 'official'], hasExpiry: true, expiryDate: new Date(2028, 5, 15), expiryAlertSent: false,
      version: 1, confidential: false, accessLevel: 'INTERNAL' as AccessLevel,
      ocrProcessed: true, ocrText: 'Ahmed Ali 1098765432 Riyadh',
      scanStatus: 'CLEAN' as ScanStatus, scannedAt: now,
      uploadedBy: 'HR-ADMIN', uploadedAt: now, updatedAt: now,
    },
    {
      tenantId, fileId: 'FILE-002', fileName: 'ahmed_ali_passport.pdf', originalName: 'Passport - Ahmed Ali.pdf',
      mimeType: 'application/pdf', size: 520000, extension: 'pdf',
      storageProvider: 'LOCAL', storagePath: '/uploads/emp/ahmed_ali_passport.pdf', storageUrl: '/uploads/emp/ahmed_ali_passport.pdf',
      module: 'employees', recordId: 'EMP-001', recordName: 'Ahmed Ali',
      category: 'PASSPORT' as FileCategory,
      tags: ['passport', 'official'], hasExpiry: true, expiryDate: new Date(2027, 8, 20), expiryAlertSent: false,
      version: 1, confidential: false, accessLevel: 'RESTRICTED' as AccessLevel,
      ocrProcessed: false, scanStatus: 'CLEAN' as ScanStatus, scannedAt: now,
      uploadedBy: 'HR-ADMIN', uploadedAt: now, updatedAt: now,
    },
    {
      tenantId, fileId: 'FILE-003', fileName: 'fatima_z_contract.pdf', originalName: 'Employment Contract - Fatima.pdf',
      mimeType: 'application/pdf', size: 180000, extension: 'pdf',
      storageProvider: 'LOCAL', storagePath: '/uploads/emp/fatima_z_contract.pdf', storageUrl: '/uploads/emp/fatima_z_contract.pdf',
      module: 'employees', recordId: 'EMP-002', recordName: 'Fatima Al-Zahrani',
      category: 'CONTRACT' as FileCategory,
      tags: ['contract', 'employment'], hasExpiry: false, expiryAlertSent: false,
      version: 2, confidential: true, accessLevel: 'CONFIDENTIAL' as AccessLevel,
      ocrProcessed: false, scanStatus: 'CLEAN' as ScanStatus, scannedAt: now,
      uploadedBy: 'HR-ADMIN', uploadedAt: now, updatedAt: now,
    },
    {
      tenantId, fileId: 'FILE-004', fileName: 'safety_certificate_2026.pdf', originalName: 'Fire Safety Certificate.pdf',
      mimeType: 'application/pdf', size: 310000, extension: 'pdf',
      storageProvider: 'LOCAL', storagePath: '/uploads/company/safety_cert.pdf', storageUrl: '/uploads/company/safety_cert.pdf',
      module: 'compliance', recordId: 'COMP-001', recordName: 'Company',
      category: 'CERTIFICATE' as FileCategory,
      tags: ['safety', 'certificate', 'fire'], hasExpiry: true, expiryDate: new Date(2026, 11, 31), expiryAlertSent: false,
      version: 1, confidential: false, accessLevel: 'INTERNAL' as AccessLevel,
      ocrProcessed: false, scanStatus: 'CLEAN' as ScanStatus, scannedAt: now,
      uploadedBy: 'ADMIN', uploadedAt: now, updatedAt: now,
    },
    {
      tenantId, fileId: 'FILE-005', fileName: 'raj_patel_iqama.jpg', originalName: 'Iqama - Raj Patel.jpg',
      mimeType: 'image/jpeg', size: 890000, extension: 'jpg',
      storageProvider: 'LOCAL', storagePath: '/uploads/emp/raj_patel_iqama.jpg', storageUrl: '/uploads/emp/raj_patel_iqama.jpg',
      module: 'employees', recordId: 'EMP-020', recordName: 'Raj Patel',
      category: 'LICENSE' as FileCategory, description: 'Iqama residency permit',
      tags: ['iqama', 'residency'], hasExpiry: true, expiryDate: new Date(2026, 2, 15), expiryAlertSent: true,
      version: 1, confidential: false, accessLevel: 'RESTRICTED' as AccessLevel,
      ocrProcessed: true, ocrText: 'Raj Patel 2398765432 Riyadh',
      scanStatus: 'CLEAN' as ScanStatus, scannedAt: now,
      uploadedBy: 'HR-ADMIN', uploadedAt: now, updatedAt: now,
    },
  ]);
}

/* ── Queries ───────────────────────────────────────────────────────── */

export async function listFiles(db: Db, tenantId: string, filters?: { module?: string; recordId?: string; category?: string }) {
  const query: any = { tenantId };
  if (filters?.module) query.module = filters.module;
  if (filters?.recordId) query.recordId = filters.recordId;
  if (filters?.category) query.category = filters.category;
  return db.collection(FILES_COLL).find(query).sort({ uploadedAt: -1 }).toArray();
}

export async function getFileDetail(db: Db, tenantId: string, fileId: string) {
  return db.collection(FILES_COLL).findOne({ tenantId, fileId });
}

export async function getEmployeeFiles(db: Db, tenantId: string, recordId: string) {
  return db.collection(FILES_COLL).find({ tenantId, recordId }).sort({ category: 1, uploadedAt: -1 }).toArray();
}

export async function getExpiringFiles(db: Db, tenantId: string, daysAhead = 30) {
  const future = new Date();
  future.setDate(future.getDate() + daysAhead);
  return db.collection(FILES_COLL).find({
    tenantId, hasExpiry: true, expiryDate: { $lte: future, $exists: true },
  } as Record<string, unknown>).sort({ expiryDate: 1 }).toArray();
}

export async function getStorageUsage(db: Db, tenantId: string) {
  const result = await db.collection(FILES_COLL).aggregate([
    { $match: { tenantId } },
    { $group: { _id: null, totalSize: { $sum: '$size' }, fileCount: { $sum: 1 } } },
  ]).toArray();
  const usage: any = result[0] || { totalSize: 0, fileCount: 0 };
  return {
    totalSize: usage.totalSize,
    fileCount: usage.fileCount,
    quota: STORAGE_QUOTAS.perTenant,
    usedPercentage: Math.round((usage.totalSize / STORAGE_QUOTAS.perTenant) * 100),
    remaining: STORAGE_QUOTAS.perTenant - usage.totalSize,
  };
}

export async function searchByOCR(db: Db, tenantId: string, query: string) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return db.collection(FILES_COLL).find({
    tenantId, ocrProcessed: true, ocrText: { $regex: escaped, $options: 'i' },
  }).toArray();
}

/* ── Mutations ─────────────────────────────────────────────────────── */

export async function uploadFile(db: Db, tenantId: string, data: any, userId: string) {
  const count = await db.collection(FILES_COLL).countDocuments({ tenantId });
  const fileId = `FILE-${String(count + 1).padStart(3, '0')}`;
  const now = new Date();
  await db.collection(FILES_COLL).insertOne({
    ...data, tenantId, fileId, version: 1,
    scanStatus: 'PENDING' as ScanStatus, ocrProcessed: false, expiryAlertSent: false,
    uploadedBy: userId, uploadedAt: now, updatedAt: now,
  });
  return fileId;
}

export async function updateMetadata(db: Db, tenantId: string, fileId: string, updates: any) {
  await db.collection(FILES_COLL).updateOne(
    { tenantId, fileId },
    { $set: { ...updates, updatedAt: new Date() } },
  );
}

export async function deleteFile(db: Db, tenantId: string, fileId: string) {
  await db.collection(FILES_COLL).deleteOne({ tenantId, fileId });
}

export async function replaceVersion(db: Db, tenantId: string, fileId: string, newFileData: any, userId: string) {
  const existing = await db.collection(FILES_COLL).findOne({ tenantId, fileId });
  if (!existing) throw new Error('File not found');
  const now = new Date();
  await db.collection(FILES_COLL).updateOne(
    { tenantId, fileId },
    {
      $set: {
        ...newFileData,
        version: (existing.version || 1) + 1,
        previousVersionId: existing._id?.toString(),
        scanStatus: 'PENDING' as ScanStatus,
        ocrProcessed: false,
        uploadedBy: userId, uploadedAt: now, updatedAt: now,
      },
    },
  );
}

export async function setExpiry(db: Db, tenantId: string, fileId: string, expiryDate: Date) {
  await db.collection(FILES_COLL).updateOne(
    { tenantId, fileId },
    { $set: { hasExpiry: true, expiryDate, expiryAlertSent: false, updatedAt: new Date() } },
  );
}
