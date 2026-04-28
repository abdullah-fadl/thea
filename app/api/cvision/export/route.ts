import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { sanitizeCsvCell } from '@/lib/cvision/utils/export';

export const dynamic = 'force-dynamic';

const MODULE_COLLECTIONS: Record<string, string> = {
  employees: 'cvision_employees', departments: 'cvision_departments', positions: 'cvision_positions',
  payroll: 'cvision_payroll_profiles', leaves: 'cvision_leaves', loans: 'cvision_loans',
  attendance: 'cvision_schedule_entries', contracts: 'cvision_contracts',
};

const MODULE_FIELDS: Record<string, string[]> = {
  employees: ['employeeNo','nameEn','nameAr','email','phone','department','jobTitle','grade','status','joinDate','birthDate','gender','nationality'],
  departments: ['name','nameAr','code','parentId','managerId','status'],
  leaves: ['employeeId','type','startDate','endDate','days','status','reason'],
  loans: ['employeeId','principal','monthlyDeduction','remaining','status','startDate'],
};

function hasPerm(ctx: any, perm: string) {
  return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm);
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.EXPORT_EXECUTE)) return deny('INSUFFICIENT_PERMISSION', 'Requires EXPORT_EXECUTE');

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'export';
  const cvModule = searchParams.get('module') || 'employees';

  if (action === 'template') {
    const fields = MODULE_FIELDS[cvModule] || MODULE_FIELDS.employees;
    const csvHeader = fields.join(',');
    return new NextResponse(csvHeader + '\n', {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${cvModule}_template.csv"` },
    });
  }

  if (action === 'export') {
    const collectionName = MODULE_COLLECTIONS[cvModule];
    if (!collectionName) return NextResponse.json({ ok: false, error: `Unsupported module: ${cvModule}` }, { status: 400 });
    const db = await getCVisionDb(tenantId);
    const data = await db.collection(collectionName).find({ tenantId }).limit(10000).toArray();
    const fields = MODULE_FIELDS[cvModule] || Object.keys(data[0] || {}).filter(k => k !== '_id' && k !== 'tenantId');
    const csvRows = [fields.join(',')];
    for (const row of data) {
      csvRows.push(fields.map(f => {
        const sanitized = sanitizeCsvCell((row as Record<string, unknown>)[f]);
        return sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')
          ? `"${sanitized.replace(/"/g, '""')}"`
          : sanitized;
      }).join(','));
    }
    const format = searchParams.get('format') || 'csv';
    return new NextResponse(csvRows.join('\n'), {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${cvModule}_export.${format === 'xlsx' ? 'csv' : 'csv'}"` },
    });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.export.execute' });
