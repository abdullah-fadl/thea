import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb, getCVisionCollection } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { const roles = ctx.roles as string[] | undefined; return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[roles?.[0] as string] || []).includes(perm); }
function generateVerificationCode(): string { return Math.random().toString(36).substring(2, 8).toUpperCase(); }
function generateLetterId(): string { return `LTR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`; }

const DEFAULT_TEMPLATES = [
  { templateKey: 'salary_certificate', nameEn: 'Salary Certificate', nameAr: 'تعريف بالراتب', category: 'SALARY', bodyHtml: '<p>This is to certify that {{employeeName}} (ID: {{nationalId}}) is employed at {{companyName}} since {{joinDate}} with a total salary of {{salary}} SAR.</p>', bodyHtmlAr: '<p>نشهد بأن {{employeeNameAr}} (هوية: {{nationalId}}) يعمل لدى {{companyNameAr}} منذ {{joinDate}} براتب إجمالي {{salary}} ريال.</p>', requiresApproval: false, variables: ['employeeName','employeeNameAr','nationalId','companyName','companyNameAr','joinDate','salary'] },
  { templateKey: 'employment_certificate', nameEn: 'Employment Certificate', nameAr: 'شهادة عمل', category: 'EMPLOYMENT', bodyHtml: '<p>This is to certify that {{employeeName}} is currently employed at {{companyName}} as {{jobTitle}} in {{department}}.</p>', bodyHtmlAr: '<p>نشهد بأن {{employeeNameAr}} يعمل حالياً لدى {{companyNameAr}} بوظيفة {{jobTitleAr}} في {{departmentAr}}.</p>', requiresApproval: false, variables: ['employeeName','employeeNameAr','companyName','companyNameAr','jobTitle','jobTitleAr','department','departmentAr'] },
  { templateKey: 'experience_certificate', nameEn: 'Experience Certificate', nameAr: 'شهادة خبرة', category: 'EXPERIENCE', bodyHtml: '<p>{{employeeName}} worked at {{companyName}} from {{joinDate}} to {{todayDate}} as {{jobTitle}}.</p>', bodyHtmlAr: '<p>عمل {{employeeNameAr}} لدى {{companyNameAr}} من {{joinDate}} إلى {{todayDate}} بوظيفة {{jobTitleAr}}.</p>', requiresApproval: true, variables: ['employeeName','employeeNameAr','companyName','companyNameAr','joinDate','todayDate','jobTitle','jobTitleAr'] },
  { templateKey: 'noc', nameEn: 'No Objection Certificate', nameAr: 'شهادة عدم ممانعة', category: 'NOC', bodyHtml: '<p>{{companyName}} has no objection to {{employeeName}} for the purpose of {{purpose}}.</p>', bodyHtmlAr: '<p>لا تمانع {{companyNameAr}} على {{employeeNameAr}} لغرض {{purpose}}.</p>', requiresApproval: true, variables: ['employeeName','employeeNameAr','companyName','companyNameAr','purpose'] },
  { templateKey: 'bank_letter', nameEn: 'Bank Letter', nameAr: 'خطاب للبنك', category: 'SALARY', bodyHtml: '<p>To whom it may concern, {{employeeName}} earns a total salary of {{salary}} SAR/month.</p>', bodyHtmlAr: '<p>إلى من يهمه الأمر، يتقاضى {{employeeNameAr}} راتباً إجمالياً {{salary}} ريال/شهر.</p>', requiresApproval: false, variables: ['employeeName','employeeNameAr','salary'] },
  { templateKey: 'embassy_letter', nameEn: 'Embassy Letter', nameAr: 'خطاب للسفارة', category: 'EMPLOYMENT', bodyHtml: '<p>This certifies {{employeeName}} is employed with a salary of {{salary}} SAR and has {{annualLeaveBalance}} days leave balance.</p>', bodyHtmlAr: '<p>نشهد بأن {{employeeNameAr}} يعمل براتب {{salary}} ريال ولديه رصيد {{annualLeaveBalance}} يوم إجازة.</p>', requiresApproval: true, variables: ['employeeName','employeeNameAr','salary','annualLeaveBalance'] },
  { templateKey: 'housing_letter', nameEn: 'Housing Letter', nameAr: 'خطاب سكن', category: 'SALARY', bodyHtml: '<p>{{employeeName}} receives a housing allowance of {{housingAllowance}} SAR.</p>', bodyHtmlAr: '<p>يتقاضى {{employeeNameAr}} بدل سكن {{housingAllowance}} ريال.</p>', requiresApproval: false, variables: ['employeeName','employeeNameAr','housingAllowance'] },
  { templateKey: 'warning_letter', nameEn: 'Warning Letter', nameAr: 'إنذار', category: 'WARNING', bodyHtml: '<p>Dear {{employeeName}}, this is a {{warningLevel}} warning regarding {{reason}}.</p>', bodyHtmlAr: '<p>عزيزي {{employeeNameAr}}، هذا إنذار {{warningLevel}} بشأن {{reason}}.</p>', requiresApproval: true, variables: ['employeeName','employeeNameAr','warningLevel','reason'] },
  { templateKey: 'termination_letter', nameEn: 'Termination Letter', nameAr: 'إنهاء خدمات', category: 'TERMINATION', bodyHtml: '<p>Dear {{employeeName}}, your employment is terminated effective {{effectiveDate}}.</p>', bodyHtmlAr: '<p>عزيزي {{employeeNameAr}}، تم إنهاء خدماتك اعتباراً من {{effectiveDate}}.</p>', requiresApproval: true, variables: ['employeeName','employeeNameAr','effectiveDate'] },
  { templateKey: 'promotion_letter', nameEn: 'Promotion Letter', nameAr: 'ترقية', category: 'EMPLOYMENT', bodyHtml: '<p>Congratulations {{employeeName}}, you are promoted to {{newJobTitle}} effective {{effectiveDate}}.</p>', bodyHtmlAr: '<p>مبروك {{employeeNameAr}}، تمت ترقيتك إلى {{newJobTitle}} اعتباراً من {{effectiveDate}}.</p>', requiresApproval: true, variables: ['employeeName','employeeNameAr','newJobTitle','effectiveDate'] },
  { templateKey: 'transfer_letter', nameEn: 'Transfer Letter', nameAr: 'نقل', category: 'EMPLOYMENT', bodyHtml: '<p>Dear {{employeeName}}, you are transferred to {{newDepartment}} effective {{effectiveDate}}.</p>', bodyHtmlAr: '<p>عزيزي {{employeeNameAr}}، تم نقلك إلى {{newDepartment}} اعتباراً من {{effectiveDate}}.</p>', requiresApproval: true, variables: ['employeeName','employeeNameAr','newDepartment','effectiveDate'] },
];

async function ensureTemplates(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  const tplCol = db.collection('cvision_letter_templates');
  const count = await tplCol.countDocuments({ tenantId });
  if (count === 0) await tplCol.insertMany(DEFAULT_TEMPLATES.map(t => ({ ...t, tenantId, headerHtml: '', footerHtml: '', createdAt: new Date(), updatedAt: new Date() })));
  return tplCol;
}

async function fillVariables(bodyHtml: string, employeeId: string, tenantId: string, extra: Record<string, string> = {}): Promise<string> {
  const db = await getCVisionDb(tenantId);
  const emp = await db.collection('cvision_employees').findOne({ tenantId, id: employeeId }) as Record<string, unknown> | null;

  // Resolve department name from departmentId
  let departmentName = '';
  let departmentNameAr = '';
  if (emp?.departmentId) {
    const dept = await db.collection('cvision_departments').findOne({ tenantId, id: emp.departmentId }) as Record<string, unknown> | null;
    departmentName = String(dept?.nameEn || dept?.name || '');
    departmentNameAr = String(dept?.nameAr || '');
  }

  // Resolve job title from jobTitleId
  let jobTitleName = '';
  let jobTitleNameAr = '';
  if (emp?.jobTitleId) {
    const jt = await db.collection('cvision_job_titles').findOne({ tenantId, id: emp.jobTitleId }) as Record<string, unknown> | null;
    jobTitleName = String(jt?.nameEn || jt?.name || '');
    jobTitleNameAr = String(jt?.nameAr || '');
  }

  const employeeNameEn = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : '';
  const employeeNameAr = emp?.firstNameAr ? `${emp.firstNameAr || ''} ${emp.lastNameAr || ''}`.trim() : '';
  const settings = await db.collection('cvision_tenant_settings').findOne({ tenantId }) as Record<string, unknown> | null;
  const company = (settings?.company || {}) as Record<string, string>;
  const vars: Record<string, string> = {
    employeeName: employeeNameEn, employeeNameAr: employeeNameAr, employeeNo: String(emp?.employeeNo || ''),
    nationalId: String(emp?.nationalId || ''), jobTitle: jobTitleName, jobTitleAr: jobTitleNameAr,
    department: departmentName, departmentAr: departmentNameAr,
    salary: String(emp?.totalSalary || emp?.basicSalary || ''), basicSalary: String(emp?.basicSalary || ''),
    housingAllowance: String(emp?.housingAllowance || ''), transportAllowance: String(emp?.transportAllowance || ''),
    joinDate: (emp?.hiredAt || emp?.joinDate) ? new Date(String(emp.hiredAt || emp.joinDate)).toLocaleDateString() : '',
    companyName: String(company?.nameEn || ''), companyNameAr: String(company?.nameAr || ''),
    todayDate: new Date().toLocaleDateString('en-GB'), letterNumber: extra.letterId || '',
    iqamaNumber: String(emp?.iqamaNumber || ''), passportNumber: String(emp?.passportNumber || ''),
    ...extra,
  };
  let result = bodyHtml;
  for (const [key, val] of Object.entries(vars)) { const ek = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); result = result.replace(new RegExp(`\\{\\{${ek}\\}\\}`, 'g'), val); }
  return result;
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const db = await getCVisionDb(tenantId);
  await ensureTemplates(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    const data = await db.collection('cvision_letters').find({ tenantId }).sort({ createdAt: -1 }).limit(100).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'my-letters') {
    const empId = userId;
    const data = await db.collection('cvision_letters').find({ tenantId, employeeId: empId }).sort({ createdAt: -1 }).limit(100).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'templates') {
    const data = await db.collection('cvision_letter_templates').find({ tenantId }).limit(500).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'download') {
    const id = searchParams.get('id');
    const letter = await db.collection('cvision_letters').findOne({ tenantId, letterId: id }) as Record<string, unknown> | null;
    if (!letter) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return new NextResponse(String(letter.generatedHtml || '<p>No content</p>'), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `inline; filename="${letter.letterId}.html"` } });
  }
  if (action === 'verify') {
    const code = searchParams.get('code');
    if (!code) return NextResponse.json({ ok: false, error: 'code required' }, { status: 400 });
    // Include tenantId in the query to prevent cross-tenant letter verification.
    const letter = await db.collection('cvision_letters').findOne({ tenantId, verificationCode: code }) as Record<string, unknown> | null;
    if (!letter) return NextResponse.json({ ok: false, verified: false, message: 'Invalid verification code' });
    // Return only the minimum fields needed to confirm authenticity — never leak
    // employee PII (employeeId, nationalId, etc.) through a verification endpoint.
    return NextResponse.json({ ok: true, verified: true, data: { letterId: letter.letterId, type: letter.type, generatedAt: letter.generatedAt } });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.letters.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const db = await getCVisionDb(tenantId);
  await ensureTemplates(tenantId);
  const body = await request.json();
  const action = body.action;

  if (action === 'request') {
    const letterId = generateLetterId();
    await db.collection('cvision_letters').insertOne({
      tenantId, letterId, employeeId: body.employeeId || userId, templateKey: body.templateKey, type: body.templateKey,
      titleEn: body.titleEn || '', titleAr: body.titleAr || '', status: 'REQUESTED',
      requestedBy: userId, language: body.language || 'both', verificationCode: generateVerificationCode(),
      createdAt: new Date(), updatedAt: new Date(),
    });
    return NextResponse.json({ ok: true, data: { letterId } });
  }

  if (action === 'generate') {
    const letter = await db.collection('cvision_letters').findOne({ tenantId, letterId: body.letterId }) as Record<string, unknown> | null;
    if (!letter) return NextResponse.json({ ok: false, error: 'Letter not found' }, { status: 404 });
    const tpl = await db.collection('cvision_letter_templates').findOne({ tenantId, templateKey: letter?.templateKey }) as Record<string, unknown> | null;
    if (!tpl) return NextResponse.json({ ok: false, error: 'Template not found' }, { status: 404 });

    const filledEn = await fillVariables(String(tpl.bodyHtml || ''), String(letter.employeeId || ''), tenantId, { letterId: String(letter.letterId || ''), ...(body.extraVars || {}) });
    const filledAr = await fillVariables(String(tpl.bodyHtmlAr || ''), String(letter.employeeId || ''), tenantId, { letterId: String(letter.letterId || ''), ...(body.extraVars || {}) });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:40px;max-width:800px;margin:auto} .ar{direction:rtl;text-align:right;font-family:'Traditional Arabic',serif} .en{direction:ltr} .letterhead{text-align:center;margin-bottom:30px;border-bottom:2px solid #333;padding-bottom:20px} .qr{text-align:center;margin-top:30px;font-size:12px;color:#666} .letter-id{color:#666;font-size:12px}</style></head><body><div class="letterhead"><h2>${letter.letterId}</h2></div><div class="en">${filledEn}</div><hr style="margin:30px 0"/><div class="ar">${filledAr}</div><div class="qr"><p>Verification: ${letter.verificationCode}</p><p class="letter-id">${letter.letterId}</p></div></body></html>`;

    await db.collection('cvision_letters').updateOne({ tenantId, letterId: body.letterId }, { $set: { status: 'GENERATED', generatedHtml: html, generatedAt: new Date(), updatedAt: new Date() } });
    return NextResponse.json({ ok: true, data: { letterId: body.letterId } });
  }

  if (action === 'approve') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.LETTERS_APPROVE)) return deny('INSUFFICIENT_PERMISSION', 'Requires LETTERS_APPROVE');
    await db.collection('cvision_letters').updateOne({ tenantId, letterId: body.letterId }, { $set: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date(), updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.letters.write' });
