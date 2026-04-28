import { NextRequest, NextResponse } from 'next/server';
import type { Document } from 'mongodb';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { validateEmployeeData, validateSaudiPhone } from '@/lib/cvision/validators';
import { calculateEmployeeFields } from '@/lib/cvision/calculated-fields';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'completeness-report';

  if (action === 'find-duplicates') {
    // Build dept map for name resolution
    const depts = await db.collection('cvision_departments').find({ tenantId }).project({ id: 1, name: 1 }).limit(500).toArray();
    const deptMap = new Map(depts.map(d => [d.id, d.name]));

    const pipeline = [
      { $match: { tenantId, isArchived: { $ne: true } } },
      {
        $addFields: {
          fullNameLower: { $toLower: { $concat: [{ $ifNull: ['$firstName', ''] }, ' ', { $ifNull: ['$lastName', ''] }] } },
        },
      },
      {
        $group: {
          _id: { name: '$fullNameLower', dob: '$dateOfBirth' },
          count: { $sum: 1 },
          employees: {
            $push: {
              _id: '$id', name: { $concat: [{ $ifNull: ['$firstName', ''] }, ' ', { $ifNull: ['$lastName', ''] }] },
              email: '$email', phone: '$phone', nationalId: '$nationalId', departmentId: '$departmentId',
            },
          },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
    ];
    const duplicates = await db.collection('cvision_employees').aggregate(pipeline as any[]).toArray();
    // Resolve department names
    for (const group of duplicates as any[]) {
      for (const emp of group.employees) {
        emp.department = deptMap.get(emp.departmentId) || emp.departmentId || '—';
        delete emp.departmentId;
      }
    }
    return NextResponse.json({ ok: true, data: duplicates, total: duplicates.length });
  }

  if (action === 'completeness-report') {
    const employees = await db.collection('cvision_employees').find({ tenantId, isArchived: { $ne: true }, deletedAt: null }).limit(5000).toArray();
    // Map required fields to actual schema field names
    const requiredFieldsMap: Record<string, string> = {
      'firstName': 'First Name', 'lastName': 'Last Name', 'email': 'Email',
      'phone': 'Phone', 'nationalId': 'National ID', 'dateOfBirth': 'Date of Birth',
      'gender': 'Gender', 'departmentId': 'Department', 'jobTitle': 'Job Title',
      'joinDate': 'Join Date', 'nationality': 'Nationality',
    };
    const requiredFields = Object.keys(requiredFieldsMap);

    const report = employees.map(emp => {
      const empName = emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeNo || 'Unknown';
      const filled = requiredFields.filter(f => {
        const val = emp[f];
        return val != null && val !== '';
      });
      const missing = requiredFields.filter(f => !emp[f] || emp[f] === '');
      return {
        employeeId: emp.id || emp._id,
        employeeName: empName,
        completeness: Math.round((filled.length / requiredFields.length) * 100),
        missingFields: missing.map(f => requiredFieldsMap[f] || f),
      };
    });

    report.sort((a, b) => a.completeness - b.completeness);
    const avgCompleteness = report.length > 0
      ? Math.round(report.reduce((s, r) => s + r.completeness, 0) / report.length)
      : 0;

    return NextResponse.json({ ok: true, data: report, avgCompleteness, total: report.length });
  }

  if (action === 'calculated-fields') {
    const empId = searchParams.get('employeeId');
    if (!empId) return NextResponse.json({ ok: false, error: 'employeeId required' }, { status: 400 });
    const emp = await db.collection('cvision_employees').findOne({ tenantId, $or: [{ id: empId }, { _id: empId as unknown as Document['_id'] }] });
    if (!emp) return NextResponse.json({ ok: false, error: 'Employee not found' }, { status: 404 });
    return NextResponse.json({ ok: true, data: calculateEmployeeFields(emp) });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.audit.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const action = body.action;

  if (action === 'validate') {
    const result = await validateEmployeeData(db, tenantId, body.data || {});
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'merge-duplicates') {
    const { keepId, mergeIds, fieldOverrides } = body;
    if (!keepId || !mergeIds?.length) {
      return NextResponse.json({ ok: false, error: 'keepId and mergeIds required' }, { status: 400 });
    }

    const keepDoc = await db.collection('cvision_employees').findOne({ tenantId, $or: [{ id: keepId }, { _id: keepId as unknown as Document['_id'] }] });
    if (!keepDoc) return NextResponse.json({ ok: false, error: 'Primary record not found' }, { status: 404 });

    // Apply overrides from merged records
    if (fieldOverrides && typeof fieldOverrides === 'object') {
      await db.collection('cvision_employees').updateOne(
        { tenantId, $or: [{ id: keepId }, { _id: keepId as unknown as Document['_id'] }] },
        { $set: { ...fieldOverrides, updatedAt: new Date() } },
      );
    }

    // Update references in related collections to point to keepId
    const relatedCollections = [
      'cvision_attendance', 'cvision_leaves', 'cvision_payroll_records',
      'cvision_loans', 'cvision_letters', 'cvision_training_enrollments',
      'cvision_files', 'cvision_transport_allowance',
    ];

    let referencesUpdated = 0;
    for (const coll of relatedCollections) {
      const result = await db.collection(coll).updateMany(
        { tenantId, employeeId: { $in: mergeIds } },
        { $set: { employeeId: keepId } },
      );
      referencesUpdated += result.modifiedCount;
    }

    // Remove duplicate records
    await db.collection('cvision_employees').deleteMany({ tenantId, $or: [{ id: { $in: mergeIds } }, { _id: { $in: mergeIds } as unknown as Document['_id'] }] });

    return NextResponse.json({
      ok: true, data: { keepId, merged: mergeIds.length, referencesUpdated },
    });
  }

  if (action === 'standardize') {
    const dryRun = body.dryRun !== false;
    const employees = await db.collection('cvision_employees').find({ tenantId, deletedAt: null }).limit(5000).toArray();
    const changes: any[] = [];

    for (const emp of employees) {
      const updates: Record<string, any> = {};
      const empName = emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeNo || 'Unknown';

      // Name casing — firstName
      if (emp.firstName && emp.firstName !== toTitleCase(emp.firstName)) {
        updates.firstName = toTitleCase(emp.firstName);
      }
      // Name casing — lastName
      if (emp.lastName && emp.lastName !== toTitleCase(emp.lastName)) {
        updates.lastName = toTitleCase(emp.lastName);
      }

      // Phone normalization
      if (emp.phone) {
        const ph = validateSaudiPhone(emp.phone);
        if (ph.valid && ph.formatted && ph.formatted !== emp.phone) {
          updates.phone = ph.formatted;
        }
      }

      // Email lowercase
      if (emp.email && emp.email !== emp.email.toLowerCase()) {
        updates.email = emp.email.toLowerCase();
      }

      if (Object.keys(updates).length > 0) {
        changes.push({ employeeId: emp.id || emp._id, name: empName, changes: updates });
        if (!dryRun) {
          await db.collection('cvision_employees').updateOne(
            { tenantId, _id: emp._id },
            { $set: { ...updates, updatedAt: new Date() } },
          );
        }
      }
    }

    return NextResponse.json({ ok: true, dryRun, total: changes.length, data: changes });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.config.write' });

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase());
}
