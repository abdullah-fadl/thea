import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionCollection, getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { validateEmployeeData, type ImportError } from '@/lib/cvision/validation';

export const dynamic = 'force-dynamic';

/**
 * Explicit whitelist of module names that are allowed as import targets.
 * The value is the exact MongoDB collection suffix used: cvision_<module>.
 * Any module name not in this set is rejected with a 400 before any DB
 * operation takes place, preventing an attacker from targeting arbitrary
 * Prisma models or MongoDB collections via the `module` parameter.
 */
const ALLOWED_IMPORT_MODULES = new Set([
  'employees',
  'departments',
  'positions',
  'locations',
  'cost_centers',
  'contracts',
]);

function hasPerm(ctx: any, perm: string) {
  return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm);
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'history';
  const col = await getCVisionCollection<any>(tenantId, 'importJobs');

  if (action === 'history') {
    const data = await col.find({ tenantId }).sort({ createdAt: -1 }).limit(20).toArray();
    return NextResponse.json({ ok: true, data });
  }
  if (action === 'status') {
    const jobId = searchParams.get('jobId');
    if (!jobId) return NextResponse.json({ ok: false, error: 'jobId required' }, { status: 400 });
    const job = await col.findOne({ tenantId, jobId });
    return NextResponse.json({ ok: true, data: job });
  }
  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.import.execute' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.IMPORT_EXECUTE)) return deny('INSUFFICIENT_PERMISSION', 'Requires IMPORT_EXECUTE');

  const body = await request.json();
  const action = body.action;
  const col = await getCVisionCollection<any>(tenantId, 'importJobs');

  if (action === 'upload') {
    // Client sends parsed data (parsed via xlsx on client-side)
    const { module, fileName, headers, rows } = body;
    if (!module || !headers || !rows) return NextResponse.json({ ok: false, error: 'module, headers, rows required' }, { status: 400 });
    // Whitelist check: reject any module name that is not explicitly allowed.
    if (!ALLOWED_IMPORT_MODULES.has(module)) {
      return NextResponse.json({ ok: false, error: `Invalid module. Allowed values: ${[...ALLOWED_IMPORT_MODULES].join(', ')}` }, { status: 400 });
    }
    const jobId = uuidv4();
    await col.insertOne({ tenantId, jobId, module, fileName: fileName || 'import.xlsx', totalRows: rows.length, successRows: 0, errorRows: 0, errors: [], status: 'PENDING', headers, previewRows: rows.slice(0, 5), columnMapping: null, createdBy: userId, createdAt: new Date(), updatedAt: new Date() });
    return NextResponse.json({ ok: true, data: { jobId, headers, previewRows: rows.slice(0, 5), totalRows: rows.length } });
  }

  if (action === 'map') {
    const { jobId, columnMapping } = body;
    if (!jobId || !columnMapping) return NextResponse.json({ ok: false, error: 'jobId, columnMapping required' }, { status: 400 });
    await col.updateOne({ tenantId, jobId }, { $set: { columnMapping, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'validate') {
    const { jobId, rows } = body;
    if (!jobId) return NextResponse.json({ ok: false, error: 'jobId required' }, { status: 400 });
    const job = await col.findOne({ tenantId, jobId });
    if (!job) return NextResponse.json({ ok: false, error: 'Job not found' }, { status: 404 });
    const errors: ImportError[] = [];
    const dataRows = rows || [];
    for (let i = 0; i < dataRows.length; i++) {
      const rowErrors = validateEmployeeData(dataRows[i], i + 1);
      errors.push(...rowErrors);
    }
    await col.updateOne({ tenantId, jobId }, { $set: { errors, errorRows: errors.length, status: errors.length > 0 ? 'PENDING' : 'PENDING', updatedAt: new Date() } });
    return NextResponse.json({ ok: true, data: { totalErrors: errors.length, errors: errors.slice(0, 100) } });
  }

  if (action === 'execute') {
    const { jobId, rows, module } = body;
    if (!jobId) return NextResponse.json({ ok: false, error: 'jobId required' }, { status: 400 });
    // Whitelist check: re-validate module on execute so that even if the upload
    // step is bypassed the collection name can never be attacker-controlled.
    const targetModule: string = module || 'employees';
    if (!ALLOWED_IMPORT_MODULES.has(targetModule)) {
      return NextResponse.json({ ok: false, error: `Invalid module. Allowed values: ${[...ALLOWED_IMPORT_MODULES].join(', ')}` }, { status: 400 });
    }
    await col.updateOne({ tenantId, jobId }, { $set: { status: 'PROCESSING', updatedAt: new Date() } });
    const db = await getCVisionDb(tenantId);
    const collectionName = `cvision_${targetModule}`;
    const target = db.collection(collectionName);
    let success = 0; let errorCount = 0; const importErrors: ImportError[] = [];
    const dataRows = rows || [];
    for (let i = 0; i < dataRows.length; i++) {
      try {
        const row = { ...dataRows[i], tenantId, createdAt: new Date(), updatedAt: new Date(), importedBy: userId };
        await target.insertOne(row);
        success++;
      } catch (err: any) {
        errorCount++;
        importErrors.push({ row: i + 1, field: 'general', error: err.message || 'Insert failed' });
      }
    }
    const finalStatus = errorCount === dataRows.length ? 'FAILED' : 'COMPLETED';
    await col.updateOne({ tenantId, jobId }, { $set: { successRows: success, errorRows: errorCount, errors: importErrors, status: finalStatus, updatedAt: new Date() } });
    return NextResponse.json({ ok: true, data: { success, errors: errorCount, total: dataRows.length } });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.import.execute' });
