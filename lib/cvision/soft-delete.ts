import { getCVisionDb } from '@/lib/cvision/db';
import { v4 as uuid } from 'uuid';

export async function softDelete(tenantId: string, collection: string, documentId: string, userId: string, userName: string) {
  const db = await getCVisionDb(tenantId);
  const col = db.collection(collection);
  const doc = await col.findOne({ tenantId, ...guessFilter(collection, documentId) });
  if (!doc) throw new Error('Document not found');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await db.collection('cvision_deleted_records').insertOne({
    tenantId, deletedRecordId: uuid(), originalCollection: collection,
    originalId: documentId, document: doc,
    deletedBy: userId, deletedByName: userName,
    deletedAt: new Date(), restoredAt: null, expiresAt,
  });

  await col.deleteOne({ _id: doc._id, tenantId });
  return true;
}

export async function restore(tenantId: string, collection: string, documentId: string, userId: string, userRole?: string) {
  const db = await getCVisionDb(tenantId);
  const record = await db.collection('cvision_deleted_records').findOne({
    tenantId, originalCollection: collection, originalId: documentId, restoredAt: null,
  }) as Record<string, unknown> | null;
  if (!record) throw new Error('Deleted record not found');
  const isAdmin = userRole && ['THEA_OWNER', 'OWNER', 'CVISION_ADMIN', 'HR_ADMIN'].includes(userRole);
  if (record.deletedBy !== userId && !isAdmin) throw new Error('Only the user who deleted this record or an admin can restore it');

  const { _id, ...rest } = record.document as any;
  await db.collection(collection).insertOne({ ...rest });
  await db.collection('cvision_deleted_records').updateOne(
    { _id: record._id, tenantId },
    { $set: { restoredAt: new Date(), restoredBy: userId } },
  );
  return true;
}

export async function getDeleted(tenantId: string, collection: string, page = 1, limit = 20) {
  const db = await getCVisionDb(tenantId);
  const filter: any = { tenantId, restoredAt: null };
  if (collection) filter.originalCollection = collection;
  const total = await db.collection('cvision_deleted_records').countDocuments(filter);
  const data = await db.collection('cvision_deleted_records').find(filter).sort({ deletedAt: -1 }).skip((page - 1) * limit).limit(limit).toArray();
  return { data, total, page, limit };
}

export async function permanentDelete(tenantId: string, collection: string, documentId: string) {
  const db = await getCVisionDb(tenantId);
  await db.collection('cvision_deleted_records').deleteOne({
    tenantId, originalCollection: collection, originalId: documentId,
  });
  return true;
}

function guessFilter(collection: string, documentId: string): Record<string, string> {
  const map: Record<string, string> = {
    cvision_employees: 'id', cvision_departments: 'departmentId',
    cvision_leaves: 'leaveId', cvision_loans: 'loanId',
    cvision_training_courses: 'courseId', cvision_assets: 'assetId',
    cvision_announcements: 'announcementId', cvision_grievances: 'grievanceId',
  };
  const field = map[collection] || '_id';
  return { [field]: documentId };
}
