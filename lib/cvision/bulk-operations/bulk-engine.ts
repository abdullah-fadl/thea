import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export type BulkOpType =
  | 'SALARY_UPDATE' | 'DEPARTMENT_TRANSFER' | 'STATUS_CHANGE'
  | 'LETTER_GENERATION' | 'INSURANCE_ENROLL' | 'TAG_ASSIGN'
  | 'NOTIFICATION_SEND' | 'BONUS_ASSIGN' | 'LEAVE_CREDIT' | 'DATA_UPDATE';

export type BulkOpStatus = 'PREVIEW' | 'CONFIRMED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';

const OPS_COLL = 'cvision_bulk_operations';

const UNDO_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/* ── Seed ──────────────────────────────────────────────────────────── */

export async function ensureSeedData(db: Db, tenantId: string) {
  const coll = db.collection(OPS_COLL);
  if (await coll.countDocuments({ tenantId }) > 0) return;

  const now = new Date();
  const pastOp = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  await coll.insertMany([
    {
      tenantId, operationId: 'BLK-001', type: 'SALARY_UPDATE' as BulkOpType,
      targetEmployeeIds: ['EMP-010', 'EMP-011', 'EMP-012', 'EMP-013', 'EMP-014'],
      targetCount: 5,
      operation: { field: 'salary', value: 500, details: { adjustmentType: 'INCREMENT', amount: 500, reason: 'Annual increment' } },
      status: 'COMPLETED' as BulkOpStatus,
      results: [
        { employeeId: 'EMP-010', employeeName: 'Sara Al-Dosari', success: true, oldValue: 8000, newValue: 8500 },
        { employeeId: 'EMP-011', employeeName: 'Khalid Moh.', success: true, oldValue: 9000, newValue: 9500 },
        { employeeId: 'EMP-012', employeeName: 'Huda Al-Sayed', success: true, oldValue: 7500, newValue: 8000 },
        { employeeId: 'EMP-013', employeeName: 'Youssef Ali', success: true, oldValue: 10000, newValue: 10500 },
        { employeeId: 'EMP-014', employeeName: 'Nora Hassan', success: false, error: 'Employee on probation' },
      ],
      successCount: 4, failCount: 1,
      undoable: true, undoDeadline: new Date(pastOp.getTime() + UNDO_WINDOW_MS),
      executedBy: 'HR-ADMIN', executedAt: pastOp, createdAt: pastOp,
    },
    {
      tenantId, operationId: 'BLK-002', type: 'TAG_ASSIGN' as BulkOpType,
      targetEmployeeIds: ['EMP-001', 'EMP-002', 'EMP-003'],
      targetCount: 3,
      operation: { field: 'tags', value: 'Safety Trained', details: { tag: 'Safety Trained' } },
      status: 'COMPLETED' as BulkOpStatus,
      results: [
        { employeeId: 'EMP-001', employeeName: 'Ahmed Ali', success: true },
        { employeeId: 'EMP-002', employeeName: 'Fatima Z.', success: true },
        { employeeId: 'EMP-003', employeeName: 'Mohammed H.', success: true },
      ],
      successCount: 3, failCount: 0,
      undoable: false,
      executedBy: 'HR-ADMIN', executedAt: pastOp, createdAt: pastOp,
    },
  ]);
}

/* ── Preview ───────────────────────────────────────────────────────── */

export async function preview(db: Db, tenantId: string, type: BulkOpType, employeeIds: string[], operation: any) {
  const empColl = db.collection('cvision_employees');
  const employees = await empColl.find({ tenantId, id: { $in: employeeIds } } as Record<string, unknown>).toArray();

  const results = employees.map(emp => {
    const preview: any = {
      employeeId: emp.id || emp.employeeId || emp._id?.toString(),
      employeeName: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Unknown',
      eligible: true,
    };

    switch (type) {
      case 'SALARY_UPDATE':
        preview.currentValue = emp.salary || emp.basicSalary || 0;
        if (operation.details?.adjustmentType === 'INCREMENT') {
          preview.newValue = preview.currentValue + (operation.value || 0);
        } else if (operation.details?.adjustmentType === 'PERCENTAGE') {
          preview.newValue = Math.round(preview.currentValue * (1 + (operation.value || 0) / 100));
        } else {
          preview.newValue = operation.value || preview.currentValue;
        }
        preview.change = preview.newValue - preview.currentValue;
        break;
      case 'DEPARTMENT_TRANSFER':
        preview.currentValue = emp.department || '';
        preview.newValue = operation.value || '';
        break;
      case 'STATUS_CHANGE':
        preview.currentValue = emp.status || '';
        preview.newValue = operation.value || '';
        if (emp.status === 'TERMINATED') { preview.eligible = false; preview.reason = 'Already terminated'; }
        break;
      default:
        preview.currentValue = emp[operation.field] || '';
        preview.newValue = operation.value || '';
    }
    return preview;
  });

  const notFound = employeeIds.filter(id => !employees.some(e => (e.employeeId === id || e._id?.toString() === id)));

  return {
    type,
    totalRequested: employeeIds.length,
    found: employees.length,
    notFound,
    eligible: results.filter(r => r.eligible).length,
    ineligible: results.filter(r => !r.eligible).length,
    results,
    estimatedImpact: type === 'SALARY_UPDATE'
      ? { totalIncrease: results.filter(r => r.eligible).reduce((s, r) => s + (r.change || 0), 0), currency: 'SAR' }
      : undefined,
  };
}

/* ── Execute ───────────────────────────────────────────────────────── */

export async function execute(db: Db, tenantId: string, type: BulkOpType, employeeIds: string[], operation: any, userId: string) {
  const empColl = db.collection('cvision_employees');
  const employees = await empColl.find({ tenantId, id: { $in: employeeIds } } as Record<string, unknown>).toArray();

  const count = await db.collection(OPS_COLL).countDocuments({ tenantId });
  const operationId = `BLK-${String(count + 1).padStart(3, '0')}`;
  const now = new Date();
  const results: any[] = [];

  for (const emp of employees) {
    const empId = emp.id || emp.employeeId || emp._id?.toString();
    try {
      const oldValue = getFieldValue(emp, type, operation);
      const newValue = computeNewValue(type, oldValue, operation);

      const updateField = getUpdateField(type, operation);
      if (updateField) {
        await empColl.updateOne(
          { tenantId, _id: emp._id },
          { $set: { [updateField]: newValue, updatedAt: now } },
        );
      }

      results.push({ employeeId: empId, employeeName: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.employeeName, success: true, oldValue, newValue });
    } catch (err: any) {
      results.push({ employeeId: empId, employeeName: emp.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.employeeName, success: false, error: err.message });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  await db.collection(OPS_COLL).insertOne({
    tenantId, operationId, type,
    targetEmployeeIds: employeeIds, targetCount: employeeIds.length,
    operation, status: 'COMPLETED' as BulkOpStatus,
    results, successCount, failCount,
    undoable: type !== 'NOTIFICATION_SEND' && type !== 'LETTER_GENERATION',
    undoDeadline: new Date(now.getTime() + UNDO_WINDOW_MS),
    executedBy: userId, executedAt: now, createdAt: now,
  });

  return { operationId, successCount, failCount, results };
}

function getFieldValue(emp: any, type: BulkOpType, operation: any): any {
  switch (type) {
    case 'SALARY_UPDATE': return emp.salary || emp.basicSalary || 0;
    case 'DEPARTMENT_TRANSFER': return emp.department || '';
    case 'STATUS_CHANGE': return emp.status || '';
    case 'TAG_ASSIGN': return emp.tags || [];
    case 'BONUS_ASSIGN': return emp.bonus || 0;
    case 'LEAVE_CREDIT': return emp.leaveBalance || 0;
    default: return emp[operation.field] || '';
  }
}

function computeNewValue(type: BulkOpType, oldValue: any, operation: any): any {
  switch (type) {
    case 'SALARY_UPDATE':
      if (operation.details?.adjustmentType === 'INCREMENT') return (oldValue || 0) + (operation.value || 0);
      if (operation.details?.adjustmentType === 'PERCENTAGE') return Math.round((oldValue || 0) * (1 + (operation.value || 0) / 100));
      return operation.value || oldValue;
    case 'TAG_ASSIGN':
      return [...(Array.isArray(oldValue) ? oldValue : []), operation.value];
    case 'BONUS_ASSIGN':
      return (oldValue || 0) + (operation.value || 0);
    case 'LEAVE_CREDIT':
      return (oldValue || 0) + (operation.value || 0);
    default:
      return operation.value;
  }
}

function getUpdateField(type: BulkOpType, operation: any): string | null {
  switch (type) {
    case 'SALARY_UPDATE': return 'salary';
    case 'DEPARTMENT_TRANSFER': return 'department';
    case 'STATUS_CHANGE': return 'status';
    case 'TAG_ASSIGN': return 'tags';
    case 'BONUS_ASSIGN': return 'bonus';
    case 'LEAVE_CREDIT': return 'leaveBalance';
    case 'DATA_UPDATE': return operation.field || null;
    case 'NOTIFICATION_SEND': return null;
    case 'LETTER_GENERATION': return null;
    default: return operation.field || null;
  }
}

/* ── Undo ──────────────────────────────────────────────────────────── */

export async function undo(db: Db, tenantId: string, operationId: string) {
  const op = await db.collection(OPS_COLL).findOne({ tenantId, operationId });
  if (!op) throw new Error('Operation not found');
  if (!op.undoable) throw new Error('Operation is not undoable');
  if (op.status === 'ROLLED_BACK') throw new Error('Already rolled back');
  if (op.undoDeadline && new Date() > new Date(op.undoDeadline)) throw new Error('Undo window expired');

  const empColl = db.collection('cvision_employees');
  let restored = 0;
  for (const result of op.results || []) {
    if (!result.success || result.oldValue === undefined) continue;
    const updateField = getUpdateField(op.type, op.operation);
    if (updateField) {
      await empColl.updateOne(
        { tenantId, $or: [{ employeeId: result.employeeId }, { _id: result.employeeId }] },
        { $set: { [updateField]: result.oldValue, updatedAt: new Date() } },
      );
      restored++;
    }
  }

  await db.collection(OPS_COLL).updateOne(
    { tenantId, operationId },
    { $set: { status: 'ROLLED_BACK' as BulkOpStatus, undoneAt: new Date() } },
  );

  return { restored };
}

/* ── History ───────────────────────────────────────────────────────── */

export async function getHistory(db: Db, tenantId: string, limit = 20) {
  return db.collection(OPS_COLL).find({ tenantId }).sort({ createdAt: -1 }).limit(limit).toArray();
}

export async function getOperationDetail(db: Db, tenantId: string, operationId: string) {
  return db.collection(OPS_COLL).findOne({ tenantId, operationId });
}
