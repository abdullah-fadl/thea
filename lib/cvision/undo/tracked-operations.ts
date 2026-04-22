/**
 * CVision Tracked Operations — Undo & Soft Delete with Recycle Bin
 *
 * Provides:
 * - trackedDelete: Moves document to recycle bin + undo stack
 * - trackedUpdate: Snapshots previous state + undo stack
 * - undoAction: Reverses a tracked operation
 * - restoreFromBin: Restores a deleted document from recycle bin
 * - permanentDelete: Permanently removes from recycle bin
 * - listRecycleBin: Paginated listing of deleted items
 */

import { Db, Collection } from '@/lib/cvision/infra/mongo-compat';
import { v4 as uuidv4 } from 'uuid';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DeletedRecord {
  id: string;
  tenantId: string;
  sourceCollection: string;
  sourceCollectionLabel: string;
  originalId: string;
  originalData: any;
  title: string;
  deletedBy: string;
  deletedByName: string;
  deletedAt: Date;
  expiresAt: Date;
  restored: boolean;
  restoredAt?: Date;
}

export interface UndoEntry {
  id: string;
  tenantId: string;
  action: 'DELETE' | 'UPDATE';
  sourceCollection: string;
  sourceCollectionLabel: string;
  documentId: string;
  title: string;
  previousState: any;
  newState?: any;
  userId: string;
  userName: string;
  undone: boolean;
  createdAt: Date;
  expiresAt: Date;
  /** ID in cvision_deleted_records if action is DELETE */
  deletedRecordId?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const RECYCLE_BIN_COLLECTION = 'cvision_deleted_records';
const UNDO_STACK_COLLECTION = 'cvision_undo_stack';
const RECYCLE_BIN_TTL_DAYS = 30;
const UNDO_TTL_MINUTES = 60;

// ─── Collection Labels ──────────────────────────────────────────────────────

const COLLECTION_LABELS: Record<string, string> = {
  cvision_employees: 'Employee',
  cvision_departments: 'Department',
  cvision_units: 'Unit',
  cvision_job_titles: 'Job Title',
  cvision_grades: 'Grade',
  cvision_requests: 'Request',
  cvision_job_requisitions: 'Job Requisition',
  cvision_candidates: 'Candidate',
  cvision_contracts: 'Contract',
  cvision_leaves: 'Leave',
  cvision_shift_assignments: 'Shift Assignment',
  cvision_shift_templates: 'Shift Template',
  cvision_loans: 'Loan',
  cvision_payroll_profiles: 'Payroll Profile',
  cvision_payroll_runs: 'Payroll Run',
  cvision_disciplinary: 'Disciplinary',
  cvision_performance_reviews: 'Performance Review',
  cvision_promotions: 'Promotion',
  cvision_training_courses: 'Training Course',
  cvision_training_enrollments: 'Training Enrollment',
  cvision_recognitions: 'Recognition',
  cvision_letters: 'Letter',
  cvision_company_policies: 'Company Policy',
  cvision_branches: 'Branch',
  cvision_insurance_providers: 'Insurance Provider',
  cvision_insurance_policies: 'Insurance Policy',
};

function getCollectionLabel(collectionName: string): string {
  return COLLECTION_LABELS[collectionName] || collectionName.replace('cvision_', '').replace(/_/g, ' ');
}

function getDocumentTitle(doc: any, collectionName: string): string {
  if (doc.firstName && doc.lastName) return `${doc.firstName} ${doc.lastName}`;
  if (doc.name) return doc.name;
  if (doc.title) return doc.title;
  if (doc.employeeNumber) return `Employee ${doc.employeeNumber}`;
  if (doc.code) return doc.code;
  if (doc.requisitionNumber) return doc.requisitionNumber;
  if (doc.loanNumber) return doc.loanNumber;
  return `${getCollectionLabel(collectionName)} record`;
}

// ─── Tracked Delete ──────────────────────────────────────────────────────────

export async function trackedDelete(
  db: Db,
  tenantId: string,
  collectionName: string,
  documentId: string,
  userId: string,
  userName: string,
): Promise<{ success: boolean; undoId: string; deletedRecordId: string; description: string }> {
  const collection = db.collection(collectionName);
  const doc = await collection.findOne({ tenantId, id: documentId });
  if (!doc) {
    throw new Error('Document not found');
  }

  const now = new Date();
  const label = getCollectionLabel(collectionName);
  const title = getDocumentTitle(doc, collectionName);

  // 1. Insert into recycle bin
  const deletedRecordId = uuidv4();
  const deletedRecord: DeletedRecord = {
    id: deletedRecordId,
    tenantId,
    sourceCollection: collectionName,
    sourceCollectionLabel: label,
    originalId: documentId,
    originalData: doc,
    title,
    deletedBy: userId,
    deletedByName: userName,
    deletedAt: now,
    expiresAt: new Date(now.getTime() + RECYCLE_BIN_TTL_DAYS * 24 * 60 * 60 * 1000),
    restored: false,
  };
  await db.collection(RECYCLE_BIN_COLLECTION).insertOne(deletedRecord);

  // 2. Delete from original collection
  await collection.deleteOne({ tenantId, id: documentId });

  // 3. Insert into undo stack
  const undoId = uuidv4();
  const undoEntry: UndoEntry = {
    id: undoId,
    tenantId,
    action: 'DELETE',
    sourceCollection: collectionName,
    sourceCollectionLabel: label,
    documentId,
    title,
    previousState: doc,
    userId,
    userName,
    undone: false,
    createdAt: now,
    expiresAt: new Date(now.getTime() + UNDO_TTL_MINUTES * 60 * 1000),
    deletedRecordId,
  };
  await db.collection(UNDO_STACK_COLLECTION).insertOne(undoEntry);

  return {
    success: true,
    undoId,
    deletedRecordId,
    description: `Deleted ${label}: ${title}`,
  };
}

// ─── Tracked Update ──────────────────────────────────────────────────────────

export async function trackedUpdate(
  db: Db,
  tenantId: string,
  collectionName: string,
  documentId: string,
  updateData: Record<string, any>,
  userId: string,
  userName: string,
): Promise<{ success: boolean; undoId: string; description: string }> {
  const collection = db.collection(collectionName);
  const previousState = await collection.findOne({ tenantId, id: documentId });
  if (!previousState) {
    throw new Error('Document not found');
  }

  // Perform update
  const now = new Date();
  await collection.updateOne(
    { tenantId, id: documentId },
    { $set: { ...updateData, updatedAt: now, updatedBy: userId } },
  );

  const newState = await collection.findOne({ tenantId, id: documentId });
  const label = getCollectionLabel(collectionName);
  const title = getDocumentTitle(previousState, collectionName);

  // Insert into undo stack
  const undoId = uuidv4();
  const undoEntry: UndoEntry = {
    id: undoId,
    tenantId,
    action: 'UPDATE',
    sourceCollection: collectionName,
    sourceCollectionLabel: label,
    documentId,
    title,
    previousState,
    newState,
    userId,
    userName,
    undone: false,
    createdAt: now,
    expiresAt: new Date(now.getTime() + UNDO_TTL_MINUTES * 60 * 1000),
  };
  await db.collection(UNDO_STACK_COLLECTION).insertOne(undoEntry);

  const description = generateChangeDescription(label, previousState, updateData);
  return { success: true, undoId, description };
}

// ─── Undo Action ─────────────────────────────────────────────────────────────

export async function undoAction(
  db: Db,
  tenantId: string,
  undoId: string,
): Promise<{ success: boolean; description: string }> {
  const undoEntry = await db.collection(UNDO_STACK_COLLECTION).findOne({
    tenantId,
    id: undoId,
    undone: false,
  }) as unknown as UndoEntry | null;

  if (!undoEntry) {
    throw new Error('Undo action not found or already undone');
  }

  if (new Date() > undoEntry.expiresAt) {
    throw new Error('Undo action has expired');
  }

  const collection = db.collection(undoEntry.sourceCollection);

  if (undoEntry.action === 'DELETE') {
    // Restore: re-insert original document
    const { _id, ...docWithoutId } = undoEntry.previousState;
    await collection.insertOne(docWithoutId);

    // Mark recycle bin entry as restored
    if (undoEntry.deletedRecordId) {
      await db.collection(RECYCLE_BIN_COLLECTION).updateOne(
        { tenantId, id: undoEntry.deletedRecordId },
        { $set: { restored: true, restoredAt: new Date() } },
      );
    }
  } else if (undoEntry.action === 'UPDATE') {
    // Revert: replace with previous state
    const { _id, ...prevWithoutId } = undoEntry.previousState;
    await collection.replaceOne(
      { tenantId, id: undoEntry.documentId },
      prevWithoutId,
    );
  }

  // Mark undo entry as undone
  await db.collection(UNDO_STACK_COLLECTION).updateOne(
    { tenantId, id: undoId },
    { $set: { undone: true } },
  );

  return {
    success: true,
    description: `Undone: ${undoEntry.sourceCollectionLabel} "${undoEntry.title}"`,
  };
}

// ─── Recycle Bin Operations ──────────────────────────────────────────────────

export async function restoreFromBin(
  db: Db,
  tenantId: string,
  deletedRecordId: string,
): Promise<{ success: boolean; description: string }> {
  const record = await db.collection(RECYCLE_BIN_COLLECTION).findOne({
    tenantId,
    id: deletedRecordId,
    restored: false,
  }) as unknown as DeletedRecord | null;

  if (!record) {
    throw new Error('Deleted record not found or already restored');
  }

  // Re-insert into original collection
  const { _id, ...docWithoutId } = record.originalData;
  await db.collection(record.sourceCollection).insertOne(docWithoutId);

  // Mark as restored
  await db.collection(RECYCLE_BIN_COLLECTION).updateOne(
    { tenantId, id: deletedRecordId },
    { $set: { restored: true, restoredAt: new Date() } },
  );

  return {
    success: true,
    description: `Restored ${record.sourceCollectionLabel}: ${record.title}`,
  };
}

export async function permanentDelete(
  db: Db,
  tenantId: string,
  deletedRecordId: string,
): Promise<{ success: boolean }> {
  const result = await db.collection(RECYCLE_BIN_COLLECTION).deleteOne({
    tenantId,
    id: deletedRecordId,
  });

  if (result.deletedCount === 0) {
    throw new Error('Deleted record not found');
  }

  return { success: true };
}

export async function listRecycleBin(
  db: Db,
  tenantId: string,
  page = 1,
  limit = 20,
): Promise<{ items: DeletedRecord[]; total: number; page: number; hasMore: boolean }> {
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    db.collection(RECYCLE_BIN_COLLECTION)
      .find({ tenantId, restored: false })
      .sort({ deletedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray() as unknown as Promise<DeletedRecord[]>,
    db.collection(RECYCLE_BIN_COLLECTION)
      .countDocuments({ tenantId, restored: false }),
  ]);

  return {
    items,
    total,
    page,
    hasMore: skip + items.length < total,
  };
}

// ─── Recent Undoable Actions ─────────────────────────────────────────────────

export async function listRecentActions(
  db: Db,
  tenantId: string,
  limit = 10,
): Promise<UndoEntry[]> {
  const now = new Date();
  return db.collection(UNDO_STACK_COLLECTION)
    .find({
      tenantId,
      undone: false,
      expiresAt: { $gt: now },
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray() as unknown as Promise<UndoEntry[]>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateChangeDescription(
  label: string,
  previousState: any,
  updateData: Record<string, any>,
): string {
  const title = previousState.firstName && previousState.lastName
    ? `${previousState.firstName} ${previousState.lastName}`
    : previousState.name || previousState.title || label;

  const changedKeys = Object.keys(updateData).filter(
    (k) => !['updatedAt', 'updatedBy'].includes(k),
  );

  if (changedKeys.length === 0) return `Updated ${title}`;
  if (changedKeys.length === 1) return `Updated ${changedKeys[0]} of ${title}`;
  return `Updated ${changedKeys.length} fields of ${title}`;
}
