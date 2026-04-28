import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { isAdminRole, normalizeRole, CVISION_ROLES, getCVisionRole } from '@/lib/cvision/roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const EMPLOYEE_RELATED_COLLECTIONS = [
  'cvision_employees', 'cvision_attendance', 'cvision_leaves',
  'cvision_payroll_records', 'cvision_loans', 'cvision_letters',
  'cvision_training_enrollments', 'cvision_files', 'cvision_transport_allowance',
  'cvision_meal_bookings', 'cvision_safety_incidents', 'cvision_ppe_distribution',
  'cvision_bookmarks', 'cvision_search_history',
];

/**
 * Returns true if the caller holds an HR-admin-or-above CVision role,
 * which is the minimum required to access another employee's privacy data.
 * Roles that qualify: thea-owner, owner, cvision_admin, hr_admin.
 */
function callerIsHrAdmin(role: string): boolean {
  const cvisionRole = getCVisionRole(role);
  // isAdminRole covers owner, cvision_admin, hr_admin
  return isAdminRole(cvisionRole) || normalizeRole(role) === CVISION_ROLES.THEA_OWNER;
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId, userId, role }) => {
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'consent-status';
  const isHrAdmin = callerIsHrAdmin(role);

  if (action === 'consent-status') {
    // Non-admins can only view their own consent status; ignore any employeeId in the query.
    const requestedId = searchParams.get('employeeId');
    if (requestedId && requestedId !== userId && !isHrAdmin) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: you can only view your own consent status' },
        { status: 403 },
      );
    }
    const empId = isHrAdmin ? (requestedId || userId) : userId;
    const consent = await db.collection('cvision_consent_records').findOne({ tenantId, employeeId: empId });
    return NextResponse.json({ ok: true, data: consent || { consents: [] } });
  }

  if (action === 'data-export-preview') {
    // Non-admins can only preview their own data.
    const requestedId = searchParams.get('employeeId');
    if (requestedId && requestedId !== userId && !isHrAdmin) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: you can only preview your own data' },
        { status: 403 },
      );
    }
    const empId = isHrAdmin ? (requestedId || userId) : userId;
    const preview: Record<string, number> = {};
    for (const coll of EMPLOYEE_RELATED_COLLECTIONS) {
      const count = await db.collection(coll).countDocuments({
        tenantId, $or: [{ employeeId: empId }, { _id: empId as any }, { userId: empId }],
      });
      if (count > 0) preview[coll] = count;
    }
    return NextResponse.json({ ok: true, data: preview });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
});

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId, role }) => {
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const action = body.action;
  const isHrAdmin = callerIsHrAdmin(role);

  if (action === 'data-export-request') {
    // Non-admins may only export their own data; the employeeId from the request body
    // is ignored for non-admins — the authenticated userId is always used instead.
    if (body.employeeId && body.employeeId !== userId && !isHrAdmin) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: you can only export your own data' },
        { status: 403 },
      );
    }
    const empId = isHrAdmin ? (body.employeeId || userId) : userId;
    const allData: Record<string, any[]> = {};

    for (const coll of EMPLOYEE_RELATED_COLLECTIONS) {
      const docs = await db.collection(coll).find({
        tenantId, $or: [{ employeeId: empId }, { _id: empId as any }, { userId: empId }],
      }).toArray();
      if (docs.length > 0) allData[coll] = docs;
    }

    await db.collection('cvision_privacy_requests').insertOne({
      tenantId, employeeId: empId, type: 'DATA_EXPORT',
      requestedBy: userId, status: 'COMPLETED', createdAt: new Date(),
    });

    return NextResponse.json({ ok: true, data: allData });
  }

  if (action === 'data-deletion-request') {
    // Non-admins may only request deletion of their own data.
    if (body.employeeId && body.employeeId !== userId && !isHrAdmin) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: you can only request deletion of your own data' },
        { status: 403 },
      );
    }
    const empId = isHrAdmin ? (body.employeeId || userId) : userId;
    const reason = body.reason || '';

    // Check retention requirements
    const employee = await db.collection('cvision_employees').findOne({
      tenantId, $or: [{ employeeId: empId }, { _id: empId as any }],
    });

    if (!employee) {
      return NextResponse.json({ ok: false, error: 'Employee not found' }, { status: 404 });
    }

    const retentionIssues: string[] = [];
    if (employee.status === 'ACTIVE') {
      retentionIssues.push('Cannot delete data for active employees');
    }

    const hasPayroll = await db.collection('cvision_payroll_records').countDocuments({ tenantId, employeeId: empId });
    if (hasPayroll > 0) {
      retentionIssues.push(`${hasPayroll} payroll records must be retained for 7 years per Saudi regulations`);
    }

    if (retentionIssues.length > 0 && !body.forceAnonymize) {
      return NextResponse.json({
        ok: false,
        error: 'Retention requirements prevent full deletion',
        retentionIssues,
        suggestion: 'Use forceAnonymize: true to anonymize instead of delete',
      }, { status: 409 });
    }

    // Anonymize instead of delete for audit trail
    const anonId = `ANON_${Date.now().toString(36)}`;
    await db.collection('cvision_employees').updateOne(
      { _id: employee._id },
      {
        $set: {
          name: `Former Employee ${anonId}`,
          email: `${anonId}@anonymized.local`,
          phone: '', nationalId: '', bankIBAN: '',
          dateOfBirth: null, emergencyContact: null,
          anonymized: true, anonymizedAt: new Date(), anonymizedBy: userId,
          anonymizeReason: reason,
        },
      },
    );

    await db.collection('cvision_privacy_requests').insertOne({
      tenantId, employeeId: empId, type: 'DATA_DELETION',
      requestedBy: userId, anonymizedAs: anonId,
      status: 'COMPLETED', createdAt: new Date(),
    });

    return NextResponse.json({ ok: true, data: { anonymizedAs: anonId, retentionIssues } });
  }

  if (action === 'anonymize') {
    // Anonymization is an HR-admin-only operation; there is no self-service path.
    if (!isHrAdmin) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: only HR admins can anonymize employee records' },
        { status: 403 },
      );
    }

    const empId = body.employeeId;
    if (!empId) return NextResponse.json({ ok: false, error: 'employeeId required' }, { status: 400 });

    const anonId = `ANON_${Date.now().toString(36)}`;
    await db.collection('cvision_employees').updateOne(
      { tenantId, $or: [{ employeeId: empId }, { _id: empId as any }] },
      {
        $set: {
          name: `Employee ${anonId}`,
          email: `${anonId}@masked.com`,
          phone: '+966XXXXXXXXX', nationalId: 'XXXXXXXXXX', bankIBAN: 'SAXXXXXXXXXXXXXXXXXXXXXXXXXX',
          anonymized: true, anonymizedAt: new Date(),
        },
      },
    );
    return NextResponse.json({ ok: true, data: { anonymizedAs: anonId } });
  }

  if (action === 'update-consent') {
    const { consentType, granted } = body;
    // Users may only manage their own consent. HR admins may manage consent on behalf of any employee.
    const requestedEmployeeId = body.employeeId as string | undefined;
    if (requestedEmployeeId && requestedEmployeeId !== userId && !isHrAdmin) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: you can only update your own consent' },
        { status: 403 },
      );
    }
    const empId = isHrAdmin ? (requestedEmployeeId || userId) : userId;
    await db.collection('cvision_consent_records').updateOne(
      { tenantId, employeeId: empId },
      {
        $set: { updatedAt: new Date() },
        $push: {
          consents: {
            type: consentType,
            granted,
            grantedAt: granted ? new Date() : undefined,
            revokedAt: !granted ? new Date() : undefined,
            recordedBy: userId,
          },
        } as any,
      },
      { upsert: true },
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
});
