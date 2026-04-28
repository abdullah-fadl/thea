import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionCollection, getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import type { AuthzContext } from '@/lib/cvision/authz/types';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: AuthzContext, perm: string) {
  return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm);
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.SELF_SERVICE)) return deny('INSUFFICIENT_PERMISSION', 'Requires SELF_SERVICE');
  const rawEmpId = ctx.employeeId || userId;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'dashboard';
  const db = await getCVisionDb(tenantId);

  // Resolve the actual employee record — try by id, then userId link, then email fallback
  let resolvedEmp = await db.collection('cvision_employees').findOne({ tenantId, id: rawEmpId });
  if (!resolvedEmp) resolvedEmp = await db.collection('cvision_employees').findOne({ tenantId, userId: rawEmpId });
  if (!resolvedEmp) {
    try {
      const userDoc = await db.collection('cvision_tenant_users').findOne({ tenantId, userId: rawEmpId });
      if (userDoc && (userDoc as Record<string, unknown>).email) {
        resolvedEmp = await db.collection('cvision_employees').findOne({
          tenantId, email: (userDoc as Record<string, unknown>).email, isArchived: { $ne: true },
        });
      }
    } catch { /* non-critical fallback */ }
  }
  const empId = (resolvedEmp as Record<string, unknown> | null)?.id as string || rawEmpId;

  if (action === 'dashboard') {
    const emp = resolvedEmp;
    const leaveBalance = await db.collection('cvision_leave_balances').findOne({ tenantId, employeeId: empId });
    // requesterId is stored in JSON 'data' column; fetch recent instances and filter
    const recentInstances = await db.collection('cvision_workflow_instances').find({ tenantId }).sort({ startedAt: -1 }).limit(20).toArray();
    const lastRequest = recentInstances.find((r) => {
      const doc = r as Record<string, unknown>;
      const d = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data as Record<string, unknown>;
      return d?.requesterId === empId || d?.requesterId === rawEmpId;
    }) || null;
    const unreadNotifs = await db.collection('cvision_notifications').countDocuments({ tenantId, recipientId: empId, readAt: null });

    // Resolve department name from departmentId
    let departmentName = '';
    const empDoc = emp as Record<string, unknown> | null;
    if (empDoc?.departmentId) {
      const dept = await db.collection('cvision_departments').findOne({ tenantId, id: empDoc.departmentId }) as Record<string, unknown> | null;
      departmentName = (dept?.nameEn as string) || (dept?.name as string) || '';
    }
    // Resolve job title from jobTitleId
    let jobTitleName = '';
    if (empDoc?.jobTitleId) {
      const jt = await db.collection('cvision_job_titles').findOne({ tenantId, id: empDoc.jobTitleId }) as Record<string, unknown> | null;
      jobTitleName = (jt?.nameEn as string) || (jt?.name as string) || '';
    }

    const lr = lastRequest as Record<string, unknown> | null;
    return NextResponse.json({ ok: true, data: {
      employee: empDoc ? { name: `${(empDoc.firstName as string) || ''} ${(empDoc.lastName as string) || ''}`.trim(), jobTitle: jobTitleName, department: departmentName } : null,
      leaveBalance: leaveBalance || { annual: 0, sick: 0, used: 0 },
      lastRequest: lr ? { type: lr.resourceType, status: lr.status, date: lr.startedAt } : null,
      unreadNotifications: unreadNotifs,
    }});
  }

  if (action === 'my-profile') {
    return NextResponse.json({ ok: true, data: resolvedEmp });
  }

  if (action === 'my-leaves') {
    const leaves = await db.collection('cvision_leaves').find({ tenantId, employeeId: empId, deletedAt: null }).sort({ createdAt: -1 }).limit(50).toArray();
    const balance = await db.collection('cvision_leave_balances').findOne({ tenantId, employeeId: empId });
    return NextResponse.json({ ok: true, data: { leaves, balance: balance || { annual: 21, sick: 30, used: 0, remaining: 21 } } });
  }

  if (action === 'my-payslips') {
    const payslips = await db.collection('cvision_payroll_profiles').find({ tenantId, employeeId: empId }).sort({ month: -1 }).limit(12).toArray();
    return NextResponse.json({ ok: true, data: payslips });
  }

  if (action === 'my-attendance') {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const attendance = await db.collection('cvision_schedule_entries').find({ tenantId, employeeId: empId, date: { $gte: startOfMonth } }).sort({ date: -1 }).limit(100).toArray();
    return NextResponse.json({ ok: true, data: attendance });
  }

  if (action === 'my-loans') {
    const loans = await db.collection('cvision_loans').find({ tenantId, employeeId: empId }).sort({ createdAt: -1 }).limit(100).toArray();
    return NextResponse.json({ ok: true, data: loans });
  }

  if (action === 'my-requests') {
    // requesterId is stored in JSON 'data' column, not a direct column.
    // Fetch recent workflow instances for the tenant and filter by data.requesterId in JS.
    const allInstances = await db.collection('cvision_workflow_instances').find({ tenantId }).sort({ startedAt: -1 }).limit(200).toArray();
    const requests = allInstances.filter((r) => {
      const doc = r as Record<string, unknown>;
      const d = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data as Record<string, unknown>;
      return d?.requesterId === empId;
    });
    // Add instanceId and resourceId aliases for backward compatibility with scenario checks
    const enriched = requests.slice(0, 50).map((r) => {
      const doc = r as Record<string, unknown>;
      const d = typeof doc.data === 'string' ? JSON.parse(doc.data as string) : doc.data as Record<string, unknown>;
      return { ...doc, instanceId: doc.id, requesterId: d?.requesterId };
    });
    return NextResponse.json({ ok: true, data: enriched });
  }

  if (action === 'my-documents') {
    const emp = await db.collection('cvision_employees').findOne({ tenantId, id: empId });
    const docs = [];
    if (emp) {
      const e = emp as Record<string, unknown>;
      if (e.contractEndDate) docs.push({ type: 'Contract', expiryDate: e.contractEndDate });
      if (e.iqamaExpiryDate) docs.push({ type: 'Iqama', expiryDate: e.iqamaExpiryDate });
      if (e.passportExpiryDate) docs.push({ type: 'Passport', expiryDate: e.passportExpiryDate });
    }
    return NextResponse.json({ ok: true, data: docs });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.self_service' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.SELF_SERVICE)) return deny('INSUFFICIENT_PERMISSION', 'Requires SELF_SERVICE');
  const rawEmpId = ctx.employeeId || userId;
  const body = await request.json();
  const action = body.action;
  const db = await getCVisionDb(tenantId);

  // Resolve employee ID (same logic as GET handler)
  let postEmp = await db.collection('cvision_employees').findOne({ tenantId, id: rawEmpId });
  if (!postEmp) postEmp = await db.collection('cvision_employees').findOne({ tenantId, userId: rawEmpId });
  if (!postEmp) {
    try {
      const userDoc = await db.collection('cvision_tenant_users').findOne({ tenantId, userId: rawEmpId });
      if (userDoc && (userDoc as Record<string, unknown>).email) {
        postEmp = await db.collection('cvision_employees').findOne({ tenantId, email: (userDoc as Record<string, unknown>).email, isArchived: { $ne: true } });
      }
    } catch { /* non-critical fallback */ }
  }
  const empId = (postEmp as Record<string, unknown> | null)?.id as string || rawEmpId;

  if (action === 'update-personal') {
    const { phone, email, emergencyContact, address } = body;
    await db.collection('cvision_employees').updateOne(
      { tenantId, id: empId },
      { $set: { phone, email, emergencyContact, address, updatedAt: new Date() } },
    );
    return NextResponse.json({ ok: true });
  }

  if (action === 'request-leave') {
    const leaveId = uuidv4();
    // PostgreSQL schema: id (PK), tenantId, employeeId, leaveType (enum), startDate, endDate, days, reason, status, ...
    // Use 'id' as PK (not 'leaveId') and 'leaveType' (not 'type') to match the cvision_leaves table columns.
    const doc = { id: leaveId, tenantId, employeeId: empId, leaveType: body.leaveType || 'ANNUAL', startDate: body.startDate, endDate: body.endDate, days: body.days || 1, reason: body.reason || '', status: 'PENDING', createdAt: new Date(), updatedAt: new Date() };
    await db.collection('cvision_leaves').insertOne(doc);
    // Start workflow
    await fetch(new URL('/api/cvision/workflow-instances', request.url).toString(), {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') || '' },
      body: JSON.stringify({ action: 'start', triggerType: 'LEAVE', resourceType: 'LEAVE', resourceId: leaveId, requesterName: body.requesterName || empId, managerId: body.managerId }),
    });
    return NextResponse.json({ ok: true, data: { leaveId } });
  }

  if (action === 'request-loan') {
    const principal = typeof body.amount === 'number' ? body.amount : Number(body.amount) || 0;
    if (principal <= 0) {
      return NextResponse.json({ ok: false, error: 'Loan amount must be greater than zero.' }, { status: 400 });
    }

    // Configurable salary multiplier cap (default 5×)
    const LOAN_SALARY_MULTIPLIER = Number(process.env.CVISION_LOAN_SALARY_MULTIPLIER) || 5;
    // Hard cap when salary data is unavailable
    const LOAN_HARD_CAP = Number(process.env.CVISION_LOAN_HARD_CAP) || 50000;

    // Resolve employee salary from payroll profile
    const payrollProfile = await db.collection('cvision_payroll_profiles')
      .findOne({ tenantId, employeeId: empId }, { sort: { month: -1 } });
    const monthlySalary = (payrollProfile as Record<string, unknown> | null)?.basicSalary as number
      ?? (payrollProfile as Record<string, unknown> | null)?.grossSalary as number
      ?? null;

    if (monthlySalary != null && monthlySalary > 0) {
      const maxAllowed = monthlySalary * LOAN_SALARY_MULTIPLIER;
      if (principal > maxAllowed) {
        return NextResponse.json({
          ok: false,
          error: `Loan amount (${principal} SAR) exceeds the maximum allowed (${maxAllowed} SAR — ${LOAN_SALARY_MULTIPLIER}× monthly salary of ${monthlySalary} SAR).`,
        }, { status: 422 });
      }
    } else {
      // No salary data — apply hard cap
      if (principal > LOAN_HARD_CAP) {
        return NextResponse.json({
          ok: false,
          error: `Loan amount (${principal} SAR) exceeds the maximum allowed (${LOAN_HARD_CAP} SAR). Salary data is unavailable so a hard cap applies.`,
        }, { status: 422 });
      }
    }

    const loanId = uuidv4();
    const installments = body.installments || 12;
    const monthlyDeduction = installments > 0 ? (principal / installments) : 0;
    const loanNumber = `LN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    // PostgreSQL schema: id (PK), tenantId, employeeId, loanNumber, principal,
    // monthlyDeduction, remaining, status, startDate, endDate, notes, isArchived, createdAt, updatedAt
    await db.collection('cvision_loans').insertOne({
      id: loanId, tenantId, employeeId: empId, loanNumber,
      principal, monthlyDeduction, remaining: principal,
      status: 'PENDING', startDate: new Date(), notes: body.reason || '',
      isArchived: false, createdAt: new Date(), updatedAt: new Date(),
    });
    return NextResponse.json({ ok: true, data: { loanId } });
  }

  if (action === 'request-letter') {
    const letterId = uuidv4();
    // PostgreSQL schema: id (PK), tenantId, employeeId, templateId, type, content, contentAr,
    // generatedAt, status, issuedAt, issuedBy, createdAt, updatedAt, createdBy, updatedBy
    await db.collection('cvision_letters').insertOne({
      id: letterId, tenantId, employeeId: empId,
      templateId: body.templateKey || body.templateId || null,
      type: body.type || 'SALARY_CERTIFICATE',
      status: 'draft', generatedAt: new Date(),
      createdAt: new Date(), updatedAt: new Date(), createdBy: empId,
    });
    return NextResponse.json({ ok: true, data: { letterId } });
  }

  if (action === 'request-training') {
    // PostgreSQL schema: id (PK), tenantId, courseId, employeeId, scheduledDate,
    // completedDate, status, score, certificate, feedback, createdAt, updatedAt, createdBy
    await db.collection('cvision_training_enrollments').insertOne({
      id: uuidv4(), tenantId, courseId: body.courseId, employeeId: empId,
      status: 'enrolled', createdAt: new Date(), updatedAt: new Date(), createdBy: empId,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'request-general') {
    const reqId = uuidv4();
    // PostgreSQL schema: id (PK), tenantId, workflowId, resourceType, resourceId,
    // currentStep, status, data (Json), startedAt, completedAt, createdAt, updatedAt
    await db.collection('cvision_workflow_instances').insertOne({
      id: reqId, tenantId, workflowId: '', resourceType: 'GENERAL', resourceId: reqId,
      currentStep: 1, status: 'IN_PROGRESS',
      data: { requesterId: empId, requesterName: body.requesterName || empId, subject: body.subject, description: body.description },
      startedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    });
    return NextResponse.json({ ok: true, data: { requestId: reqId } });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.self_service' });
