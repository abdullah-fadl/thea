import { getCVisionDb } from '@/lib/cvision/db';
import { v4 as uuid } from 'uuid';

export async function recordChange(
  tenantId: string, userId: string, userName: string,
  collection: string, documentId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  before: any, after: any
) {
  const db = await getCVisionDb(tenantId);
  const doc = {
    tenantId, changeId: uuid(), userId, userName, collection, documentId,
    action, before, after, undone: false, undoneAt: null, createdAt: new Date(),
  };
  await db.collection('cvision_undo_stack').insertOne(doc);
  return doc.changeId;
}

export async function undoChange(tenantId: string, changeId: string) {
  const db = await getCVisionDb(tenantId);
  const change = await db.collection('cvision_undo_stack').findOne({ tenantId, changeId, undone: false }) as any;
  if (!change) throw new Error('Change not found or already undone');

  const col = db.collection(change.collection);
  const idField = guessIdField(change.collection);

  if (change.action === 'CREATE') {
    await col.deleteOne({ [idField]: change.documentId, tenantId });
  } else if (change.action === 'UPDATE') {
    if (change.before) {
      const { _id, ...rest } = change.before;
      await col.replaceOne({ [idField]: change.documentId, tenantId }, { ...rest, tenantId });
    }
  } else if (change.action === 'DELETE') {
    if (change.before) {
      const { _id, ...rest } = change.before;
      await col.insertOne({ ...rest, tenantId });
    }
  }

  await db.collection('cvision_undo_stack').updateOne({ tenantId, changeId }, { $set: { undone: true, undoneAt: new Date() } });
  return true;
}

export async function getUndoHistory(tenantId: string, userId: string, limit = 20) {
  const db = await getCVisionDb(tenantId);
  return db.collection('cvision_undo_stack')
    .find({ tenantId, userId, undone: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

function guessIdField(collection: string): string {
  const map: Record<string, string> = {
    cvision_employees: 'id', cvision_departments: 'departmentId',
    cvision_leaves: 'leaveId', cvision_loans: 'loanId',
    cvision_training_courses: 'courseId', cvision_assets: 'assetId',
    cvision_announcements: 'announcementId', cvision_grievances: 'grievanceId',
    cvision_contracts: 'contractId', cvision_letters: 'letterId',
  };
  return map[collection] || '_id';
}
