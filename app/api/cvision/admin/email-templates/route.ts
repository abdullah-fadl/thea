import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionCollection } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';

export const dynamic = 'force-dynamic';

const DEFAULTS = [
  { key: 'leave_approved', subject: 'Leave Request Approved', subjectAr: 'تمت الموافقة على طلب الإجازة', bodyHtml: '<p>Dear {{employeeName}},</p><p>Your leave request from {{startDate}} to {{endDate}} has been approved.</p>', bodyHtmlAr: '<p>عزيزي {{employeeName}}،</p><p>تمت الموافقة على إجازتك من {{startDate}} إلى {{endDate}}.</p>', variables: ['employeeName','startDate','endDate','leaveType'], isActive: true },
  { key: 'leave_rejected', subject: 'Leave Request Rejected', subjectAr: 'تم رفض طلب الإجازة', bodyHtml: '<p>Dear {{employeeName}},</p><p>Your leave request has been rejected. Reason: {{reason}}</p>', bodyHtmlAr: '<p>عزيزي {{employeeName}}،</p><p>تم رفض طلب إجازتك. السبب: {{reason}}</p>', variables: ['employeeName','reason'], isActive: true },
  { key: 'loan_approved', subject: 'Loan Approved', subjectAr: 'تمت الموافقة على القرض', bodyHtml: '<p>Dear {{employeeName}},</p><p>Your loan of {{amount}} SAR has been approved.</p>', bodyHtmlAr: '<p>عزيزي {{employeeName}}،</p><p>تمت الموافقة على قرضك بمبلغ {{amount}} ريال.</p>', variables: ['employeeName','amount'], isActive: true },
  { key: 'contract_expiring', subject: 'Contract Expiring Soon', subjectAr: 'العقد يقترب من الانتهاء', bodyHtml: '<p>{{employeeName}}\'s contract expires on {{expiryDate}}.</p>', bodyHtmlAr: '<p>عقد {{employeeName}} ينتهي في {{expiryDate}}.</p>', variables: ['employeeName','expiryDate'], isActive: true },
  { key: 'iqama_expiring', subject: 'Iqama Expiring', subjectAr: 'الإقامة تقترب من الانتهاء', bodyHtml: '<p>{{employeeName}}\'s Iqama expires on {{expiryDate}}.</p>', bodyHtmlAr: '<p>إقامة {{employeeName}} تنتهي في {{expiryDate}}.</p>', variables: ['employeeName','expiryDate'], isActive: true },
  { key: 'letter_ready', subject: 'Letter Ready', subjectAr: 'الخطاب جاهز', bodyHtml: '<p>Dear {{employeeName}},</p><p>Your {{letterType}} is ready for download.</p>', bodyHtmlAr: '<p>عزيزي {{employeeName}}،</p><p>خطاب {{letterType}} جاهز للتحميل.</p>', variables: ['employeeName','letterType'], isActive: true },
  { key: 'onboarding_welcome', subject: 'Welcome to {{companyName}}', subjectAr: 'مرحباً بك في {{companyName}}', bodyHtml: '<p>Dear {{employeeName}},</p><p>Welcome aboard! Your start date is {{startDate}}.</p>', bodyHtmlAr: '<p>عزيزي {{employeeName}}،</p><p>مرحباً بك! تاريخ بدء العمل {{startDate}}.</p>', variables: ['employeeName','companyName','startDate'], isActive: true },
  { key: 'password_reset', subject: 'Password Reset', subjectAr: 'إعادة تعيين كلمة المرور', bodyHtml: '<p>Click <a href="{{resetLink}}">here</a> to reset your password.</p>', bodyHtmlAr: '<p>اضغط <a href="{{resetLink}}">هنا</a> لإعادة تعيين كلمة المرور.</p>', variables: ['resetLink'], isActive: true },
  { key: 'performance_review_due', subject: 'Performance Review Due', subjectAr: 'موعد تقييم الأداء', bodyHtml: '<p>Dear {{managerName}},</p><p>Performance review for {{employeeName}} is due by {{dueDate}}.</p>', bodyHtmlAr: '<p>عزيزي {{managerName}}،</p><p>تقييم أداء {{employeeName}} مطلوب قبل {{dueDate}}.</p>', variables: ['managerName','employeeName','dueDate'], isActive: true },
];

async function ensureDefaults(tenantId: string) {
  const col = await getCVisionCollection<any>(tenantId, 'tenantSettings');
  const emailCol = await getCVisionCollection<any>(tenantId, 'notifications');
  // Use a simple check on a dedicated collection-like approach
  const db = (await import('@/lib/cvision/db')).getCVisionDb;
  const dbInst = await db(tenantId);
  const tplCol = dbInst.collection('cvision_email_templates');
  const count = await tplCol.countDocuments({ tenantId });
  if (count === 0) {
    await tplCol.insertMany(DEFAULTS.map(d => ({ ...d, tenantId, createdAt: new Date(), updatedAt: new Date() })));
  }
  return tplCol;
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const tplCol = await ensureDefaults(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';
  if (action === 'list') {
    const data = await tplCol.find({ tenantId }).limit(200).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'get') {
    const key = searchParams.get('key');
    if (!key) return NextResponse.json({ ok: false, error: 'key required' }, { status: 400 });
    const data = await tplCol.findOne({ tenantId, key });
    return NextResponse.json({ ok: true, data });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.config.write' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const rolePerms: string[] = CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || [];
  if (!ctx.isOwner && !rolePerms.includes(CVISION_PERMISSIONS.CONFIG_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires CONFIG_WRITE');
  const tplCol = await ensureDefaults(tenantId);
  const body = await request.json();
  if (body.action !== 'update' || !body.key) return NextResponse.json({ ok: false, error: 'action=update + key required' }, { status: 400 });
  const { key, ...updates } = body; delete updates.action; delete updates.tenantId;
  await tplCol.updateOne({ tenantId, key }, { $set: { ...updates, updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
},
  { platformKey: 'cvision', permissionKey: 'cvision.config.write' });
