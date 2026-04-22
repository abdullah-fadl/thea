import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

const ONBOARDING_TASKS = [
  { taskId: 'hr-1', title: 'Collect identity documents', titleAr: 'تجميع الوثائق الشخصية', category: 'HR', assigneeType: 'HR', daysFromStart: 0, isMandatory: true },
  { taskId: 'hr-2', title: 'Create employee file', titleAr: 'إنشاء ملف الموظف', category: 'HR', assigneeType: 'HR', daysFromStart: 1, isMandatory: true },
  { taskId: 'hr-3', title: 'Add to payroll system', titleAr: 'الإضافة لنظام الرواتب', category: 'HR', assigneeType: 'HR', daysFromStart: 2, isMandatory: true },
  { taskId: 'hr-4', title: 'Setup medical insurance', titleAr: 'تفعيل التأمين الطبي', category: 'HR', assigneeType: 'HR', daysFromStart: 3, isMandatory: true },
  { taskId: 'hr-5', title: 'Assign leave balance', titleAr: 'تخصيص رصيد الإجازات', category: 'HR', assigneeType: 'HR', daysFromStart: 1, isMandatory: true },
  { taskId: 'hr-6', title: 'Create employment contract', titleAr: 'إنشاء عقد العمل', category: 'HR', assigneeType: 'HR', daysFromStart: 0, isMandatory: true },
  { taskId: 'hr-7', title: 'Register in GOSI', titleAr: 'تسجيل في التأمينات', category: 'HR', assigneeType: 'HR', daysFromStart: 5, isMandatory: true },
  { taskId: 'it-1', title: 'Create email account', titleAr: 'إنشاء حساب البريد', category: 'IT', assigneeType: 'SPECIFIC_ROLE', daysFromStart: 0, isMandatory: true },
  { taskId: 'it-2', title: 'Setup laptop/workstation', titleAr: 'تجهيز الحاسب', category: 'IT', assigneeType: 'SPECIFIC_ROLE', daysFromStart: 0, isMandatory: true },
  { taskId: 'it-3', title: 'Grant system access permissions', titleAr: 'منح صلاحيات النظام', category: 'IT', assigneeType: 'SPECIFIC_ROLE', daysFromStart: 1, isMandatory: true },
  { taskId: 'it-4', title: 'Issue security badge', titleAr: 'إصدار بطاقة أمنية', category: 'IT', assigneeType: 'SPECIFIC_ROLE', daysFromStart: 0, isMandatory: false },
  { taskId: 'fac-1', title: 'Assign desk/workspace', titleAr: 'تخصيص مكتب', category: 'FACILITIES', assigneeType: 'SPECIFIC_ROLE', daysFromStart: 0, isMandatory: true },
  { taskId: 'fac-2', title: 'Assign parking spot', titleAr: 'تخصيص موقف', category: 'FACILITIES', assigneeType: 'SPECIFIC_ROLE', daysFromStart: 1, isMandatory: false },
  { taskId: 'fac-3', title: 'Provide key card', titleAr: 'منح بطاقة دخول', category: 'FACILITIES', assigneeType: 'SPECIFIC_ROLE', daysFromStart: 0, isMandatory: true },
  { taskId: 'dep-1', title: 'Team introduction', titleAr: 'تعريف بالفريق', category: 'DEPARTMENT', assigneeType: 'MANAGER', daysFromStart: 0, isMandatory: true },
  { taskId: 'dep-2', title: 'Assign buddy/mentor', titleAr: 'تعيين مرشد', category: 'DEPARTMENT', assigneeType: 'MANAGER', daysFromStart: 0, isMandatory: true },
  { taskId: 'dep-3', title: 'Department orientation', titleAr: 'تعريف بالقسم', category: 'DEPARTMENT', assigneeType: 'MANAGER', daysFromStart: 1, isMandatory: true },
  { taskId: 'dep-4', title: 'Set initial goals/OKRs', titleAr: 'وضع الأهداف الأولية', category: 'DEPARTMENT', assigneeType: 'MANAGER', daysFromStart: 7, isMandatory: true },
  { taskId: 'tr-1', title: 'Company orientation session', titleAr: 'جلسة تعريف بالشركة', category: 'TRAINING', assigneeType: 'HR', daysFromStart: 1, isMandatory: true },
  { taskId: 'tr-2', title: 'Safety training', titleAr: 'تدريب السلامة', category: 'TRAINING', assigneeType: 'SPECIFIC_ROLE', daysFromStart: 3, isMandatory: true },
  { taskId: 'tr-3', title: 'Systems training', titleAr: 'تدريب على الأنظمة', category: 'TRAINING', assigneeType: 'IT', daysFromStart: 5, isMandatory: true },
  { taskId: 'tr-4', title: 'Policy acknowledgment', titleAr: 'الإقرار بالسياسات', category: 'TRAINING', assigneeType: 'HR', daysFromStart: 2, isMandatory: true },
  { taskId: 'hr-8', title: '30-day check-in meeting', titleAr: 'اجتماع المتابعة بعد 30 يوم', category: 'HR', assigneeType: 'HR', daysFromStart: 30, isMandatory: true },
  { taskId: 'hr-9', title: '60-day performance review', titleAr: 'مراجعة أداء 60 يوم', category: 'HR', assigneeType: 'MANAGER', daysFromStart: 60, isMandatory: true },
  { taskId: 'hr-10', title: '90-day probation review', titleAr: 'تقييم فترة التجربة', category: 'HR', assigneeType: 'HR', daysFromStart: 90, isMandatory: true },
];

const OFFBOARDING_TASKS = [
  { taskId: 'off-hr-1', title: 'Accept resignation/termination', titleAr: 'قبول الاستقالة/الإنهاء', category: 'HR', assigneeType: 'HR', daysFromStart: 0, isMandatory: true },
  { taskId: 'off-hr-2', title: 'Calculate end of service', titleAr: 'حساب مكافأة نهاية الخدمة', category: 'HR', assigneeType: 'HR', daysFromStart: 5, isMandatory: true },
  { taskId: 'off-hr-3', title: 'Prepare final settlement', titleAr: 'إعداد المخالصة النهائية', category: 'HR', assigneeType: 'HR', daysFromStart: 10, isMandatory: true },
  { taskId: 'off-hr-4', title: 'Issue experience certificate', titleAr: 'إصدار شهادة خبرة', category: 'HR', assigneeType: 'HR', daysFromStart: 14, isMandatory: true },
  { taskId: 'off-hr-5', title: 'Cancel medical insurance', titleAr: 'إلغاء التأمين الطبي', category: 'HR', assigneeType: 'HR', daysFromStart: 14, isMandatory: true },
  { taskId: 'off-hr-6', title: 'Deregister from GOSI', titleAr: 'إلغاء التسجيل من التأمينات', category: 'HR', assigneeType: 'HR', daysFromStart: 14, isMandatory: true },
  { taskId: 'off-hr-7', title: 'Exit interview', titleAr: 'مقابلة خروج', category: 'HR', assigneeType: 'HR', daysFromStart: 7, isMandatory: false },
  { taskId: 'off-it-1', title: 'Revoke all system access', titleAr: 'إلغاء صلاحيات الأنظمة', category: 'IT', assigneeType: 'SPECIFIC_ROLE', daysFromStart: 0, isMandatory: true },
  { taskId: 'off-it-2', title: 'Collect laptop/equipment', titleAr: 'استلام الأجهزة', category: 'IT', assigneeType: 'SPECIFIC_ROLE', daysFromStart: 0, isMandatory: true },
  { taskId: 'off-it-3', title: 'Deactivate email account', titleAr: 'إلغاء حساب البريد', category: 'IT', assigneeType: 'SPECIFIC_ROLE', daysFromStart: 1, isMandatory: true },
  { taskId: 'off-it-4', title: 'Backup employee data', titleAr: 'نسخ بيانات الموظف', category: 'IT', assigneeType: 'SPECIFIC_ROLE', daysFromStart: 0, isMandatory: true },
  { taskId: 'off-fac-1', title: 'Collect key card', titleAr: 'استلام بطاقة الدخول', category: 'FACILITIES', assigneeType: 'SPECIFIC_ROLE', daysFromStart: 0, isMandatory: true },
  { taskId: 'off-fac-2', title: 'Collect parking card', titleAr: 'استلام بطاقة الموقف', category: 'FACILITIES', assigneeType: 'SPECIFIC_ROLE', daysFromStart: 0, isMandatory: false },
  { taskId: 'off-fin-1', title: 'Settle outstanding loans', titleAr: 'تسوية القروض', category: 'FINANCE', assigneeType: 'SPECIFIC_ROLE', daysFromStart: 5, isMandatory: true },
  { taskId: 'off-fin-2', title: 'Settle advances', titleAr: 'تسوية السلف', category: 'FINANCE', assigneeType: 'SPECIFIC_ROLE', daysFromStart: 5, isMandatory: true },
  { taskId: 'off-fin-3', title: 'Process final payslip', titleAr: 'إصدار كشف الراتب الأخير', category: 'FINANCE', assigneeType: 'SPECIFIC_ROLE', daysFromStart: 14, isMandatory: true },
  { taskId: 'off-dep-1', title: 'Knowledge transfer sessions', titleAr: 'جلسات نقل المعرفة', category: 'DEPARTMENT', assigneeType: 'MANAGER', daysFromStart: 0, isMandatory: true },
  { taskId: 'off-dep-2', title: 'Handover documents', titleAr: 'تسليم الملفات', category: 'DEPARTMENT', assigneeType: 'MANAGER', daysFromStart: 7, isMandatory: true },
  { taskId: 'off-dep-3', title: 'Update team responsibilities', titleAr: 'تحديث مسؤوليات الفريق', category: 'DEPARTMENT', assigneeType: 'MANAGER', daysFromStart: 3, isMandatory: true },
];

async function ensureTemplates(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  const tplCol = db.collection('cvision_onboarding_templates');
  const count = await tplCol.countDocuments({ tenantId });
  if (count === 0) {
    await tplCol.insertMany([
      { tenantId, id: uuidv4(), name: 'Standard Onboarding', description: 'إجراءات تعيين قياسية', tasks: JSON.stringify(ONBOARDING_TASKS), isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { tenantId, id: uuidv4(), name: 'Standard Offboarding', description: 'إجراءات إنهاء قياسية', tasks: JSON.stringify(OFFBOARDING_TASKS), isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ]);
  }
  return tplCol;
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const db = await getCVisionDb(tenantId);
  await ensureTemplates(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';
  const instCol = db.collection('cvision_onboarding_instances');

  if (action === 'list') {
    const data = await instCol.find({ tenantId }).sort({ createdAt: -1 }).limit(50).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'detail') {
    const id = searchParams.get('id');
    const doc = await instCol.findOne({ tenantId, id });
    return NextResponse.json({ ok: true, data: doc });
  }
  if (action === 'templates') {
    const data = await db.collection('cvision_onboarding_templates').find({ tenantId }).limit(100).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'dashboard') {
    const [inProgress, overdue, completed] = await Promise.all([
      instCol.countDocuments({ tenantId, status: 'in_progress' }),
      instCol.countDocuments({ tenantId, status: 'in_progress', expectedEndDate: { $lt: new Date() } }),
      instCol.countDocuments({ tenantId, status: 'completed' }),
    ]);
    return NextResponse.json({ ok: true, data: { inProgress, overdue, completed } });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.onboarding.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.ONBOARDING_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires ONBOARDING_WRITE');
  const db = await getCVisionDb(tenantId);
  await ensureTemplates(tenantId);
  const body = await request.json();
  const action = body.action;
  const instCol = db.collection('cvision_onboarding_instances');

  if (action === 'start') {
    const { employeeId, employeeName, type, templateId } = body;
    if (!employeeId || !type) return NextResponse.json({ ok: false, error: 'employeeId and type required' }, { status: 400 });
    const tplCol = db.collection('cvision_onboarding_templates');
    let tpl: any;
    if (templateId) {
      tpl = await tplCol.findOne({ tenantId, id: templateId });
    } else {
      const allTpls = await tplCol.find({ tenantId, isActive: true }).limit(100).toArray();
      tpl = allTpls.find((t: any) => (t.name || '').toLowerCase().includes(type === 'OFFBOARDING' ? 'offboarding' : 'onboarding'));
    }
    if (!tpl) return NextResponse.json({ ok: false, error: 'Template not found' }, { status: 404 });
    const startDate = new Date();
    const rawTasks = typeof tpl.tasks === 'string' ? JSON.parse(tpl.tasks) : (tpl.tasks || []);
    const tasks = rawTasks.map((t: any) => ({ ...t, status: 'TODO', dueDate: new Date(startDate.getTime() + (t.daysFromStart || 0) * 24 * 60 * 60 * 1000), completedAt: null, completedBy: null, assigneeId: '', assigneeName: '', notes: '' }));
    const targetDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);
    const doc = { tenantId, id: uuidv4(), employeeId, templateId: tpl.id || templateId || '', status: 'in_progress', startDate, expectedEndDate: targetDate, tasks: JSON.stringify(tasks), createdBy: userId, createdAt: new Date(), updatedAt: new Date() };
    await instCol.insertOne(doc);
    return NextResponse.json({ ok: true, data: doc });
  }

  if (action === 'complete-task') {
    const { instanceId, taskId, notes } = body;
    if (!instanceId || !taskId) return NextResponse.json({ ok: false, error: 'instanceId and taskId required' }, { status: 400 });
    const inst = await instCol.findOne({ tenantId, id: instanceId }) as Record<string, unknown> | null;
    if (!inst) return NextResponse.json({ ok: false, error: 'Instance not found' }, { status: 404 });
    const parsedTasks = typeof inst.tasks === 'string' ? JSON.parse(inst.tasks) : (inst.tasks || []);
    const updatedTasks = parsedTasks.map((t: any) => t.taskId === taskId ? { ...t, status: 'COMPLETED', completedAt: new Date(), completedBy: userId, notes: notes || t.notes } : t);
    const completedCount = updatedTasks.filter((t: any) => t.status === 'COMPLETED').length;
    const percentage = updatedTasks.length > 0 ? Math.round((completedCount / updatedTasks.length) * 100) : 0;
    const instanceStatus = percentage === 100 ? 'completed' : 'in_progress';
    await instCol.updateOne({ tenantId, id: instanceId }, { $set: { tasks: JSON.stringify(updatedTasks), status: instanceStatus, updatedAt: new Date() } });
    return NextResponse.json({ ok: true, data: { completionPercentage: percentage, status: instanceStatus } });
  }

  if (action === 'assign-task') {
    const { instanceId, taskId, assigneeId, assigneeName } = body;
    if (!instanceId || !taskId) return NextResponse.json({ ok: false, error: 'instanceId and taskId required' }, { status: 400 });
    const inst = await instCol.findOne({ tenantId, id: instanceId }) as Record<string, unknown> | null;
    if (!inst) return NextResponse.json({ ok: false, error: 'Instance not found' }, { status: 404 });
    const parsedTasks = typeof inst.tasks === 'string' ? JSON.parse(inst.tasks) : (inst.tasks || []);
    const updatedTasks = parsedTasks.map((t: any) => t.taskId === taskId ? { ...t, assigneeId: assigneeId || '', assigneeName: assigneeName || '' } : t);
    await instCol.updateOne({ tenantId, id: instanceId }, { $set: { tasks: JSON.stringify(updatedTasks), updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.onboarding.write' });
