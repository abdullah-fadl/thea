import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { v4 as uuid } from 'uuid';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

const OPERATIONS: Record<string, { collection: string; label: string }> = {
  bulk_status_change: { collection: 'cvision_employees', label: 'Bulk Status Change' },
  bulk_department_transfer: { collection: 'cvision_employees', label: 'Bulk Department Transfer' },
  bulk_salary_update: { collection: 'cvision_employee_compensation', label: 'Bulk Salary Update' },
  bulk_leave_balance: { collection: 'cvision_leave_balances', label: 'Bulk Leave Balance Update' },
  bulk_training_enroll: { collection: 'cvision_training_enrollments', label: 'Bulk Training Enrollment' },
  bulk_notification: { collection: 'cvision_notifications', label: 'Bulk Notification' },
  bulk_field_update: { collection: 'cvision_employees', label: 'Bulk Field Update' },
};

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.BULK_OPERATIONS)) return deny('INSUFFICIENT_PERMISSION', 'Requires BULK_OPERATIONS');
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'history';

  if (action === 'status') {
    const jobId = searchParams.get('jobId');
    const job = await db.collection('cvision_bulk_operations').findOne({ tenantId, jobId });
    return NextResponse.json({ ok: true, data: job });
  }

  const jobs = await db.collection('cvision_bulk_operations').find({ tenantId }).sort({ startedAt: -1 }).limit(50).toArray();
  return NextResponse.json({ ok: true, data: jobs });
},
  { platformKey: 'cvision', permissionKey: 'cvision.bulk_operations' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.BULK_OPERATIONS)) return deny('INSUFFICIENT_PERMISSION', 'Requires BULK_OPERATIONS');
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const action = body.action;

  if (action !== 'execute') return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });

  const { operation, targetIds, parameters, dryRun } = body;
  if (!operation || !OPERATIONS[operation]) return NextResponse.json({ ok: false, error: 'Unknown operation' }, { status: 400 });
  if (!Array.isArray(targetIds) || targetIds.length === 0) return NextResponse.json({ ok: false, error: 'No targets' }, { status: 400 });
  if (targetIds.length > 5000) return NextResponse.json({ ok: false, error: 'Too many targets (max 5000)' }, { status: 400 });

  // Validate bulk_field_update field allowlist early (before dry-run)
  if (operation === 'bulk_field_update') {
    const BULK_FIELD_ALLOWLIST = ['department', 'departmentId', 'unit', 'unitId', 'grade', 'gradeId', 'status', 'location', 'branch', 'jobTitle', 'costCenter', 'manager', 'managerId'];
    if (!parameters?.field || !BULK_FIELD_ALLOWLIST.includes(parameters.field)) {
      return NextResponse.json({ ok: false, error: `Field "${parameters?.field}" is not allowed for bulk update. Allowed: ${BULK_FIELD_ALLOWLIST.join(', ')}` }, { status: 400 });
    }
  }

  const opConfig = OPERATIONS[operation];
  const col = db.collection(opConfig.collection);

  if (dryRun) {
    let affectedCount = 0;
    if (operation === 'bulk_status_change' || operation === 'bulk_department_transfer' || operation === 'bulk_field_update') {
      affectedCount = await col.countDocuments({ tenantId, employeeId: { $in: targetIds } });
    } else { affectedCount = targetIds.length; }
    return NextResponse.json({ ok: true, dryRun: true, data: { operation: opConfig.label, targetCount: targetIds.length, affectedCount, parameters } });
  }

  const jobId = uuid();
  const jobDoc = { tenantId, jobId, operation, targetCount: targetIds.length, successCount: 0, failCount: 0, errors: [] as string[], parameters, executedBy: ctx.userId, executedByName: ctx.userId, dryRun: false, status: 'PROCESSING', startedAt: new Date(), completedAt: null as Date | null };
  await db.collection('cvision_bulk_operations').insertOne(jobDoc);

  let success = 0, fail = 0;
  const errors: string[] = [];

  for (const id of targetIds) {
    try {
      if (operation === 'bulk_status_change') {
        await col.updateOne({ tenantId, id }, { $set: { status: parameters.newStatus, updatedAt: new Date() } });
      } else if (operation === 'bulk_department_transfer') {
        await col.updateOne({ tenantId, id }, { $set: { departmentId: parameters.departmentId, updatedAt: new Date() } });
      } else if (operation === 'bulk_salary_update') {
        if (parameters.type === 'percentage') {
          if (typeof parameters.value !== 'number' || parameters.value > 100 || parameters.value < -100) {
            throw new Error('Percentage change must be between -100 and 100');
          }
          await col.updateOne({ tenantId, id }, [{ $set: { basicSalary: { $multiply: ['$basicSalary', 1 + parameters.value / 100] }, updatedAt: new Date() } }]);
        } else {
          if (typeof parameters.value !== 'number' || Math.abs(parameters.value) > 100000) {
            throw new Error('Flat rate change must be between -100000 and 100000');
          }
          await col.updateOne({ tenantId, id }, { $inc: { basicSalary: parameters.value }, $set: { updatedAt: new Date() } });
        }
      } else if (operation === 'bulk_leave_balance') {
        await col.updateOne({ tenantId, employeeId: id, leaveType: parameters.leaveType }, { $inc: { balance: parameters.adjustment } }, { upsert: true });
      } else if (operation === 'bulk_training_enroll') {
        await db.collection('cvision_training_enrollments').insertOne({ tenantId, enrollmentId: uuid(), courseId: parameters.courseId, employeeId: id, status: 'ENROLLED', enrolledAt: new Date() });
      } else if (operation === 'bulk_notification') {
        await db.collection('cvision_notifications').insertOne({ tenantId, notificationId: uuid(), userId: id, title: parameters.title, body: parameters.body, type: 'SYSTEM', read: false, createdAt: new Date() });
      } else if (operation === 'bulk_field_update') {
        const BULK_FIELD_ALLOWLIST = ['department', 'departmentId', 'unit', 'unitId', 'grade', 'gradeId', 'status', 'location', 'branch', 'jobTitle', 'costCenter', 'manager', 'managerId'];
        if (!BULK_FIELD_ALLOWLIST.includes(parameters.field)) {
          throw new Error(`Field "${parameters.field}" is not allowed for bulk update`);
        }
        await col.updateOne({ tenantId, id }, { $set: { [parameters.field]: parameters.value, updatedAt: new Date() } });
      }
      success++;
    } catch (e: any) { fail++; errors.push(`${id}: ${e.message}`); }
  }

  await db.collection('cvision_bulk_operations').updateOne({ tenantId, jobId }, { $set: { successCount: success, failCount: fail, errors, status: fail === targetIds.length ? 'FAILED' : 'COMPLETED', completedAt: new Date() } });

  return NextResponse.json({ ok: true, data: { jobId, successCount: success, failCount: fail, errors } });
},
  { platformKey: 'cvision', permissionKey: 'cvision.bulk_operations' });
