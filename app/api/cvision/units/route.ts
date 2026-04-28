import { logger } from '@/lib/monitoring/logger';
import { compareLegacyCvisionToCore } from '@/lib/core/units/shadowRead';
/**
 * CVision Units API
 * GET /api/cvision/units - List units (with optional includeStats, role-based filtering)
 * POST /api/cvision/units - Create unit, update, assign-employees, delete
 *
 * Role-based access:
 *  ADMIN / HR          → all units
 *  NURSING_MANAGER     → units in their department (nursingManagerId match)
 *  HEAD_NURSE          → their own unit only (headNurseId match)
 *  EMPLOYEE            → their own unit only (unitId match)
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  paginatedList,
  isCodeUnique,
  findById,
  softDelete,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
  computeChanges,
} from '@/lib/cvision/audit';
import {
  createUnitSchema,
  updateUnitSchema,
  paginationSchema,
} from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionUnit } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Nursing role type ────────────────────────────────────────
type NursingRole = 'NURSING_MANAGER' | 'HEAD_NURSE' | 'STAFF_NURSE' | 'NURSE' | null;

// ─── Admin / HR check ─────────────────────────────────────────
const ADMIN_ROLES = ['admin', 'hr-admin', 'hr-manager', 'super-admin', 'owner', 'thea-owner'];
function isAdminOrHR(role: string): boolean {
  if (!role) return false;
  return ADMIN_ROLES.includes(role.toLowerCase());
}

// ─── Resolve current employee record (cached per request) ─────
async function resolveCurrentEmployee(
  tenantId: string,
  userId: string
): Promise<any | null> {
  const empCollection = await getCVisionCollection(tenantId, 'employees');
  return empCollection.findOne(
    createTenantFilter(tenantId, { userId })
  );
}

// ─── Check if user has access to a specific unit ──────────────
function hasUnitAccess(
  role: string,
  currentUser: any,
  unit: any
): boolean {
  // Admin / HR → full access
  if (isAdminOrHR(role)) return true;
  if (!currentUser) return false;

  const empId = currentUser.id || currentUser._id?.toString();
  const nursingRole: NursingRole = currentUser.nursingRole || null;
  const unitId = unit.id || unit._id?.toString();

  // NURSING_MANAGER → units in their department or where they are nursingManagerId
  if (nursingRole === 'NURSING_MANAGER') {
    return (
      unit.nursingManagerId === empId ||
      (currentUser.departmentId && unit.departmentId === currentUser.departmentId)
    );
  }

  // HEAD_NURSE → only their own unit (where they are headNurseId)
  if (nursingRole === 'HEAD_NURSE') {
    return unit.headNurseId === empId;
  }

  // Regular employee → only their own unit
  return currentUser.unitId === unitId;
}

// GET - List units (with role-based filtering)
export const GET = withAuthTenant(
  async (request, { tenantId, userId, role }) => {
    try {
      const { searchParams } = new URL(request.url);

      // ── Fix unit codes (admin utility) ────────────────────────
      const action = searchParams.get('action');
      if (action === 'fix-codes') {
        const collection = await getCVisionCollection<CVisionUnit>(tenantId, 'units');
        const units = await collection.find(createTenantFilter(tenantId)).limit(500).toArray();
        const updates: { name: string; oldCode: string; newCode: string }[] = [];

        const codeMap: Record<string, string> = {
          'MEDICAL-WA': 'MW',
          'MEDICAL-WARD': 'MW',
          'EMERGENCY-DEPARTMENT': 'ER',
          'INTENSIVE-CARE': 'ICU',
        };

        for (const unit of units) {
          let newCode = unit.code;

          if (codeMap[unit.code]) {
            newCode = codeMap[unit.code];
          } else if (unit.code && unit.code.length > 5) {
            // Take first letter of each hyphen-separated word
            newCode = unit.code.split('-').map((w: string) => w[0]).join('').toUpperCase();
          }

          if (newCode !== unit.code) {
            await collection.updateOne(
              { tenantId, _id: unit._id },
              { $set: { code: newCode, updatedAt: new Date() } }
            );
            updates.push({ name: unit.name, oldCode: unit.code, newCode });
          }
        }

        return NextResponse.json({
          success: true,
          message: `Fixed ${updates.length} unit codes`,
          updates,
        });
      }

      const includeStats = searchParams.get('includeStats') === 'true';
      const params = paginationSchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
        search: searchParams.get('search'),
        sortBy: searchParams.get('sortBy') || 'name',
        sortOrder: searchParams.get('sortOrder'),
        includeDeleted: searchParams.get('includeDeleted'),
      });

      const collection = await getCVisionCollection<CVisionUnit>(
        tenantId,
        'units'
      );

      const departmentId = searchParams.get('departmentId');
      const isActiveFilter = searchParams.get('isActive');
      const additionalFilter: any = {};

      if (departmentId) {
        additionalFilter.departmentId = departmentId;
      }
      if (isActiveFilter !== null) {
        additionalFilter.isActive = isActiveFilter === 'true';
      }

      // ── Role-based filtering ────────────────────────────────
      if (!isAdminOrHR(role)) {
        const currentUser = await resolveCurrentEmployee(tenantId, userId);
        if (currentUser) {
          const empId = currentUser.id || currentUser._id?.toString();
          const nursingRole: NursingRole = currentUser.nursingRole || null;

          if (nursingRole === 'NURSING_MANAGER') {
            // See units in their department OR where they are nursingManagerId
            additionalFilter.$or = [
              { nursingManagerId: empId },
              ...(currentUser.departmentId
                ? [{ departmentId: currentUser.departmentId }]
                : []),
            ];
          } else if (nursingRole === 'HEAD_NURSE') {
            // See only unit where they are headNurseId
            additionalFilter.headNurseId = empId;
          } else {
            // Regular employee — see only their own unit
            if (currentUser.unitId) {
              additionalFilter.id = currentUser.unitId;
            } else {
              // No unit assigned → empty result
              return NextResponse.json({
                success: true,
                data: [],
                total: 0,
                page: 1,
                totalPages: 0,
              });
            }
          }
        }
      }

      const result = await paginatedList(
        collection,
        tenantId,
        params,
        Object.keys(additionalFilter).length > 0 ? additionalFilter : undefined
      );

      // ── Enrich with stats if requested ──────────────────────
      if (includeStats && result.data && result.data.length > 0) {
        const empCollection = await getCVisionCollection(tenantId, 'employees');
        const deptCollection = await getCVisionCollection(tenantId, 'departments');

        // Gather unique department IDs for batch lookup
        const deptIds = [...new Set(result.data.map((u) => u.departmentId).filter(Boolean))];
        const departments = deptIds.length > 0
          ? await deptCollection.find(createTenantFilter(tenantId, {
              id: { $in: deptIds },
            })).toArray()
          : [];
        const deptMap = new Map(departments.map((d) => [d.id, d]));

        // Gather head nurse / manager IDs for batch lookup
        const staffIds = new Set<string>();
        for (const unit of result.data as Record<string, any>[]) {
          if (unit.headNurseId) staffIds.add(unit.headNurseId as string);
          if (unit.nursingManagerId) staffIds.add(unit.nursingManagerId as string);
          if (unit.managerId) staffIds.add(unit.managerId as string);
        }

        const staffMembers = staffIds.size > 0
          ? await empCollection.find(createTenantFilter(tenantId, {
              id: { $in: [...staffIds] },
            })).toArray()
          : [];
        const staffMap = new Map(staffMembers.map((e: any) => [
          e.id,
          `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email || e.id,
        ]));

        // Enrich each unit
        for (const unit of result.data as Record<string, unknown>[]) {
          // Employee count
          const unitId = unit.id || unit._id?.toString();
          unit.employeeCount = await empCollection.countDocuments(
            createTenantFilter(tenantId, {
              unitId,
              status: { $in: ['ACTIVE', 'PROBATION'] },
            })
          );

          // Department name
          const dept = deptMap.get(unit.departmentId as string);
          unit.departmentName = (dept as Record<string, unknown>)?.name || (dept as Record<string, unknown>)?.nameEn || null;

          // Head Nurse name
          if (unit.headNurseId) {
            unit.headNurseName = staffMap.get(unit.headNurseId as string) || null;
          }

          // Nursing Manager name
          if (unit.nursingManagerId) {
            unit.nursingManagerName = staffMap.get(unit.nursingManagerId as string) || null;
          }

          // Manager name (existing field)
          if (unit.managerId) {
            unit.managerName = staffMap.get(unit.managerId as string) || null;
          }
        }
      }

      // Shadow-read: compare each legacy row against core_units (fire-and-forget)
      if (result.data) {
        for (const unit of result.data as Record<string, unknown>[]) {
          const legacyId = (unit.id || unit._id)?.toString();
          if (legacyId) {
            void compareLegacyCvisionToCore({
              id:       legacyId,
              tenantId,
              code:     (unit.code as string) ?? '',
              name:     (unit.name as string) ?? '',
              nameAr:   (unit.nameAr as string | null | undefined) ?? null,
            }).catch(() => {});
          }
        }
      }

      return NextResponse.json({
        success: true,
        ...result,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('[CVision Units GET]', errMsg);
      return NextResponse.json(
        { error: 'Internal server error', message: errMsg },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_READ }
);

// POST - Create unit, update, assign-employees, delete
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const { action } = body;

      const collection = await getCVisionCollection<CVisionUnit>(
        tenantId,
        'units'
      );
      const auditCtx = createCVisionAuditContext({ userId, role, tenantId, user }, request);

      // ── Create unit (default) ────────────────────────────────
      if (!action || action === 'create') {
        const data = createUnitSchema.parse(body);

        const isUnique = await isCodeUnique(collection, tenantId, data.code);
        if (!isUnique) {
          return NextResponse.json(
            { error: 'Unit code already exists' },
            { status: 400 }
          );
        }

        // Validate department exists
        const deptCollection = await getCVisionCollection(tenantId, 'departments');
        const department = await deptCollection.findOne(
          createTenantFilter(tenantId, { id: data.departmentId })
        );
        if (!department) {
          return NextResponse.json(
            { error: 'Department not found' },
            { status: 400 }
          );
        }

        const now = new Date();
        const unit: CVisionUnit = {
          id: uuidv4(),
          tenantId,
          code: data.code || '',
          name: data.name || '',
          description: data.description,
          departmentId: data.departmentId || '',
          managerId: data.managerId,
          headNurseId: data.headNurseId,
          nursingManagerId: data.nursingManagerId,
          minStaffDay: data.minStaffDay,
          minStaffNight: data.minStaffNight,
          minStaffEvening: data.minStaffEvening,
          isActive: data.isActive ?? true,
          isArchived: false,
          sortOrder: data.sortOrder,
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
        };

        await collection.insertOne(unit);

        await logCVisionAudit(auditCtx, 'unit_create', 'unit', {
          resourceId: unit.id,
          changes: { after: data },
        });

        return NextResponse.json(
          { success: true, unit },
          { status: 201 }
        );
      }

      // ── Update unit ──────────────────────────────────────────
      if (action === 'update') {
        const { unitId, ...updateFields } = body;
        if (!unitId) {
          return NextResponse.json(
            { error: 'unitId is required' },
            { status: 400 }
          );
        }

        const existing = await findById(collection, tenantId, unitId);
        if (!existing) {
          return NextResponse.json(
            { error: 'Unit not found' },
            { status: 404 }
          );
        }

        // Authorization check
        if (!isAdminOrHR(role)) {
          const currentUser = await resolveCurrentEmployee(tenantId, userId);
          if (!hasUnitAccess(role, currentUser, existing)) {
            return NextResponse.json(
              { error: 'You do not have permission to edit this unit' },
              { status: 403 }
            );
          }
        }

        // Remove action from update fields
        delete updateFields.action;
        const data = updateUnitSchema.parse(updateFields);

        // Check code uniqueness if changing
        if (data.code && data.code !== existing.code) {
          const isUnique = await isCodeUnique(collection, tenantId, data.code, unitId);
          if (!isUnique) {
            return NextResponse.json(
              { error: 'Unit code already exists in this department' },
              { status: 400 }
            );
          }
        }

        // Validate department exists if changing
        if (data.departmentId && data.departmentId !== existing.departmentId) {
          const deptCollection = await getCVisionCollection(tenantId, 'departments');
          const department = await deptCollection.findOne(
            createTenantFilter(tenantId, { id: data.departmentId })
          );
          if (!department) {
            return NextResponse.json(
              { error: 'Department not found' },
              { status: 400 }
            );
          }
        }

        const updateData = {
          ...data,
          updatedAt: new Date(),
          updatedBy: userId,
        };

        await collection.updateOne(
          createTenantFilter(tenantId, { id: unitId }),
          { $set: updateData }
        );

        const updated = await findById(collection, tenantId, unitId);

        await logCVisionAudit(auditCtx, 'unit_update', 'unit', {
          resourceId: unitId,
          changes: computeChanges(existing, updated!),
        });

        return NextResponse.json({
          success: true,
          unit: updated,
          message: 'Unit updated successfully',
        });
      }

      // ── Assign employees to unit ─────────────────────────────
      if (action === 'assign-employees') {
        const { unitId, employeeIds } = body;
        if (!unitId || !employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
          return NextResponse.json(
            { error: 'unitId and employeeIds array are required' },
            { status: 400 }
          );
        }

        // Verify unit exists
        const unit = await findById(collection, tenantId, unitId);
        if (!unit) {
          return NextResponse.json(
            { error: 'Unit not found' },
            { status: 404 }
          );
        }

        // Authorization check
        if (!isAdminOrHR(role)) {
          const currentUser = await resolveCurrentEmployee(tenantId, userId);
          if (!hasUnitAccess(role, currentUser, unit)) {
            return NextResponse.json(
              { error: 'You do not have permission to assign employees to this unit' },
              { status: 403 }
            );
          }
        }

        const empCollection = await getCVisionCollection(tenantId, 'employees');

        const result = await empCollection.updateMany(
          createTenantFilter(tenantId, {
            id: { $in: employeeIds },
          }),
          {
            $set: {
              unitId,
              updatedAt: new Date(),
              updatedBy: userId,
            },
          }
        );

        await logCVisionAudit(auditCtx, 'unit_update', 'unit', {
          resourceId: unitId,
          changes: {
            after: { assignedEmployees: employeeIds, count: result.modifiedCount },
          },
        });

        return NextResponse.json({
          success: true,
          message: `${result.modifiedCount} employees assigned to unit`,
          modifiedCount: result.modifiedCount,
        });
      }

      // ── Delete unit (soft delete) ────────────────────────────
      if (action === 'delete') {
        const { unitId } = body;
        if (!unitId) {
          return NextResponse.json(
            { error: 'unitId is required' },
            { status: 400 }
          );
        }

        const existing = await findById(collection, tenantId, unitId);
        if (!existing) {
          return NextResponse.json(
            { error: 'Unit not found' },
            { status: 404 }
          );
        }

        // Authorization check — only ADMIN/HR and NURSING_MANAGER can delete
        if (!isAdminOrHR(role)) {
          const currentUser = await resolveCurrentEmployee(tenantId, userId);
          const nursingRole: NursingRole = currentUser?.nursingRole || null;
          if (nursingRole !== 'NURSING_MANAGER' || !hasUnitAccess(role, currentUser, existing)) {
            return NextResponse.json(
              { error: 'You do not have permission to delete this unit' },
              { status: 403 }
            );
          }
        }

        // Soft delete the unit
        const success = await softDelete(collection, tenantId, unitId, userId);
        if (!success) {
          return NextResponse.json(
            { error: 'Failed to delete unit' },
            { status: 500 }
          );
        }

        // Remove unitId from assigned employees
        const empCollection = await getCVisionCollection(tenantId, 'employees');
        await empCollection.updateMany(
          createTenantFilter(tenantId, { unitId }),
          {
            $unset: { unitId: '' },
            $set: { updatedAt: new Date(), updatedBy: userId },
          }
        );

        await logCVisionAudit(auditCtx, 'unit_archive', 'unit', {
          resourceId: unitId,
        });

        return NextResponse.json({
          success: true,
          message: 'Unit deleted successfully',
        });
      }

      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: (error as Error & { errors: unknown[] }).errors },
          { status: 400 }
        );
      }
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('[CVision Units POST]', errMsg);
      return NextResponse.json(
        { error: 'Internal server error', message: errMsg },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.ORG_WRITE }
);
