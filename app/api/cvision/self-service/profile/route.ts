import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Self-Service Profile API
 * GET  /api/cvision/self-service/profile - View own profile
 * PATCH /api/cvision/self-service/profile - Update limited own profile fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { logCVisionAudit, createCVisionAuditContext } from '@/lib/cvision/audit';

export const dynamic = 'force-dynamic';

async function resolveEmployee(db: any, tenantId: string, userId: string) {
  let emp = await db.collection('cvision_employees').findOne({ tenantId, id: userId, deletedAt: null });
  if (!emp) emp = await db.collection('cvision_employees').findOne({ tenantId, userId, deletedAt: null });
  if (!emp) {
    try {
      const userDoc = await db.collection('cvision_tenant_users').findOne({ tenantId, userId });
      if (userDoc?.email) {
        emp = await db.collection('cvision_employees').findOne({ tenantId, email: userDoc.email, deletedAt: null });
      }
    } catch { /* non-critical */ }
  }
  return emp;
}

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId, userId }) => {
    try {
      const db = await getCVisionDb(tenantId);
      const employee = await resolveEmployee(db, tenantId, userId);

      if (!employee) {
        return NextResponse.json({ success: false, error: 'Employee profile not found' }, { status: 404 });
      }

      const e = employee as any;

      // Fetch related data
      const [department, leaveBalance, documents] = await Promise.all([
        e.departmentId ? db.collection('cvision_departments').findOne({ tenantId, id: e.departmentId }) : null,
        db.collection('cvision_leave_balances').find({ tenantId, employeeId: e.id, year: new Date().getFullYear() }).limit(50).toArray(),
        db.collection('cvision_employee_documents').find({ tenantId, employeeId: e.id, deletedAt: null }).limit(20).toArray(),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          id: e.id,
          employeeNumber: e.employeeNumber,
          firstName: e.firstName,
          lastName: e.lastName,
          firstNameAr: e.firstNameAr,
          lastNameAr: e.lastNameAr,
          email: e.email,
          phone: e.phone,
          personalEmail: e.personalEmail,
          emergencyContact: e.emergencyContact,
          emergencyPhone: e.emergencyPhone,
          nationalId: e.nationalId,
          nationality: e.nationality,
          dateOfBirth: e.dateOfBirth,
          gender: e.gender,
          maritalStatus: e.maritalStatus,
          jobTitle: e.jobTitle,
          jobTitleAr: e.jobTitleAr,
          departmentId: e.departmentId,
          departmentName: (department as any)?.name || '',
          departmentNameAr: (department as any)?.nameAr || '',
          status: e.status,
          hiredAt: e.hiredAt,
          basicSalary: undefined, // Hidden for self-service
          leaveBalances: leaveBalance,
          documentsCount: documents.length,
        },
      });
    } catch (error: any) {
      logger.error('[CVision Self-Service Profile GET]', error?.message || String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.SELF_SERVICE }
);

// PATCH - Update own profile (limited fields)
export const PATCH = withAuthTenant(
  async (request: NextRequest, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const db = await getCVisionDb(tenantId);
      const employee = await resolveEmployee(db, tenantId, userId);

      if (!employee) {
        return NextResponse.json({ success: false, error: 'Employee profile not found' }, { status: 404 });
      }

      // Only allow self-editable fields
      const SELF_EDITABLE = ['phone', 'personalEmail', 'emergencyContact', 'emergencyPhone', 'address', 'maritalStatus'];
      const updates: any = { updatedAt: new Date(), updatedBy: userId };

      for (const field of SELF_EDITABLE) {
        if (body[field] !== undefined) updates[field] = body[field];
      }

      if (Object.keys(updates).length <= 2) {
        return NextResponse.json({ success: false, error: 'No editable fields provided' }, { status: 400 });
      }

      await db.collection('cvision_employees').updateOne(
        { tenantId, id: (employee as any).id },
        { $set: updates }
      );

      const auditCtx = createCVisionAuditContext({ userId, role, tenantId, user }, request);
      await logCVisionAudit(auditCtx, 'self_service_profile_update', 'employee', {
        resourceId: (employee as any).id,
        changes: { after: updates },
      });

      return NextResponse.json({ success: true, message: 'Profile updated' });
    } catch (error: any) {
      logger.error('[CVision Self-Service Profile PATCH]', error?.message || String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.SELF_SERVICE }
);
