import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Employee Profile API
 * GET /api/cvision/employees/[id]/profile - Get employee profile with all sections
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  findById,
  createTenantFilter,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionEmployee, CVisionProfileSectionSchema, CVisionEmployeeProfileSection, ProfileSectionKey } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canReadEmployee, canEditProfileSection } from '@/lib/cvision/authz/policy';
import { ensureProfileSchemas } from '@/lib/cvision/profileSchemas';
import { normalizeStatus } from '@/lib/cvision/status';
import { CVISION_ROLES } from '@/lib/cvision/roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get employee profile with all sections
export const GET = withAuthTenant(
  async (request, { tenantId }, params) => {
    try {
      // Build authz context
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult; // 401 or 403
      }
      const ctx = ctxResult;

      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Employee ID is required' },
          { status: 400 }
        );
      }

      const employeeCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );

      const employee = await findById(employeeCollection, tenantId, id);

      if (!employee) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        );
      }

      // Check if employee is terminated - blocked from profile access (except HR roles and OWNER/THEA_OWNER)
      // Normalize status for comparison (handles legacy lowercase values)
      const normalizedStatus = normalizeStatus(employee.status);

      // OWNER and THEA_OWNER should always have access, even to terminated employees
      const isOwnerOrTheaOwner =
        ctx.roles.includes(CVISION_ROLES.OWNER) ||
        ctx.roles.includes(CVISION_ROLES.THEA_OWNER) ||
        ctx.isOwner ||
        ctx.cvisionRole === CVISION_ROLES.OWNER ||
        ctx.cvisionRole === CVISION_ROLES.THEA_OWNER;

      const allowedRolesForTerminated = ['cvision_admin', 'hr_admin', 'hr_manager'];
      const hasAccessToTerminated =
        isOwnerOrTheaOwner ||
        allowedRolesForTerminated.includes(ctx.cvisionRole);
      
      if (normalizedStatus === 'TERMINATED' && !hasAccessToTerminated) {
        return NextResponse.json(
          { error: 'Cannot access profile for terminated employee', code: 'TERMINATED_EMPLOYEE_BLOCKED' },
          { status: 403 }
        );
      }

      // Enforce read policy
      const readPolicy = canReadEmployee(ctx, employee);
      const enforceResult = await enforce(readPolicy, request, ctx);
      if (enforceResult) {
        return enforceResult; // 403
      }

      // Ensure profile schemas exist (bootstrap if missing)
      await ensureProfileSchemas(tenantId, ctx.userId);

      // Get all active profile schemas
      const schemaCollection = await getCVisionCollection<CVisionProfileSectionSchema>(
        tenantId,
        'profileSectionSchemas'
      );

      const schemas = await schemaCollection
        .find(createTenantFilter(tenantId, { isActive: true }))
        .toArray();

      // Get all profile sections for this employee
      const sectionCollection = await getCVisionCollection<CVisionEmployeeProfileSection>(
        tenantId,
        'employeeProfileSections'
      );

      let sections = await sectionCollection
        .find(createTenantFilter(tenantId, { employeeId: id }))
        .toArray();

      // Auto-create missing profile sections from employee data
      if (sections.length === 0) {
        const now = new Date();
        const autoSections = [
          {
            id: uuidv4(),
            tenantId,
            employeeId: id,
            sectionKey: 'PERSONAL',
            schemaVersion: 1,
            dataJson: {
              firstName: employee.firstName || null,
              lastName: employee.lastName || null,
              fullName: employee.fullName || null,
              email: employee.email || null,
              phone: employee.phone || null,
            },
            createdAt: now,
            updatedAt: now,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          },
          {
            id: uuidv4(),
            tenantId,
            employeeId: id,
            sectionKey: 'EMPLOYMENT',
            schemaVersion: 1,
            dataJson: {
              departmentId: employee.departmentId || null,
              jobTitleId: employee.jobTitleId || null,
              positionId: employee.positionId || null,
              managerEmployeeId: (employee as Record<string, unknown>).managerEmployeeId || null,
              gradeId: employee.gradeId || null,
              hiredAt: employee.hiredAt ? new Date(employee.hiredAt).toISOString() : null,
            },
            createdAt: now,
            updatedAt: now,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          },
          {
            id: uuidv4(),
            tenantId,
            employeeId: id,
            sectionKey: 'FINANCIAL',
            schemaVersion: 1,
            dataJson: {
              basicSalary: null,
              housingAllowance: null,
              transportAllowance: null,
              bankName: null,
              bankAccountNumber: null,
              iban: null,
            },
            createdAt: now,
            updatedAt: now,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          },
          {
            id: uuidv4(),
            tenantId,
            employeeId: id,
            sectionKey: 'CONTRACT',
            schemaVersion: 1,
            dataJson: {
              contractId: null,
              contractNo: null,
              contractType: null,
              startDate: employee.hiredAt ? new Date(employee.hiredAt).toISOString() : null,
              endDate: null,
              probationEndDate: employee.hiredAt
                ? new Date(new Date(employee.hiredAt).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
                : null,
              vacationDaysPerYear: 21,
            },
            createdAt: now,
            updatedAt: now,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          },
        ];

        // Also check if there's a contract for financial data
        const contractCollection = await getCVisionCollection<any>(tenantId, 'contracts');
        const contract = await contractCollection.findOne(
          createTenantFilter(tenantId, { employeeId: id, isActive: true })
        );

        if (contract) {
          const financialSection = autoSections.find(s => s.sectionKey === 'FINANCIAL');
          if (financialSection) {
            financialSection.dataJson.basicSalary = contract.basicSalary || null;
            financialSection.dataJson.housingAllowance = contract.housingAllowance || null;
            financialSection.dataJson.transportAllowance = contract.transportAllowance || null;
          }
          const contractSection = autoSections.find(s => s.sectionKey === 'CONTRACT');
          if (contractSection) {
            contractSection.dataJson.contractId = contract.id;
            contractSection.dataJson.contractNo = contract.contractNo || null;
            contractSection.dataJson.contractType = contract.type || null;
            contractSection.dataJson.startDate = contract.startDate ? new Date(contract.startDate).toISOString() : null;
            contractSection.dataJson.endDate = contract.endDate ? new Date(contract.endDate).toISOString() : null;
          }
        }

        await sectionCollection.insertMany(autoSections as any);
        sections = autoSections as any;
        logger.info('[CVision Profile] Auto-created profile sections for employee:', id);
      }

      // Get history (last 10 entries per section)
      const historyCollection = await getCVisionCollection<any>(
        tenantId,
        'employeeProfileSectionHistory'
      );

      const history = await historyCollection
        .find(createTenantFilter(tenantId, { employeeId: id }))
        .sort({ createdAt: -1 })
        .limit(50) // Last 50 changes across all sections
        .toArray();

      // Build response: sections with schema, data, and edit permissions
      const sectionsMap: any = {};
      const sectionKeys: ProfileSectionKey[] = ['PERSONAL', 'EMPLOYMENT', 'FINANCIAL', 'CONTRACT'];

      for (const sectionKey of sectionKeys) {
        const schema = schemas.find(s => s.sectionKey === sectionKey);
        const section = sections.find(s => s.sectionKey === sectionKey);
        const sectionHistory = history.filter(h => h.sectionKey === sectionKey).slice(0, 10);

        // Check edit permission for this section
        const editPolicy = canEditProfileSection(ctx, employee, sectionKey);
        const canEdit = editPolicy.allowed;

        sectionsMap[sectionKey] = {
          schemaVersion: schema?.version || null,
          schemaJson: schema?.schemaJson || null,
          dataJson: section?.dataJson || {},
          updatedAt: section?.updatedAt || null,
          canEdit,
          editReason: editPolicy.reason || null,
          history: sectionHistory.map(h => ({
            id: h.id,
            schemaVersion: h.schemaVersion,
            prevDataJson: h.prevDataJson,
            nextDataJson: h.nextDataJson,
            changedByUserId: h.changedByUserId,
            changeReason: h.changeReason,
            createdAt: h.createdAt,
          })),
        };
      }

      // Normalize employee status in response (compatibility layer for legacy data)
      const normalizedEmployee = {
        ...employee,
        status: normalizeStatus(employee.status), // Normalize to canonical for response
      };

      return NextResponse.json({
        success: true,
        employee: normalizedEmployee,
        sections: sectionsMap,
        // Dev diagnostics
        _diagnostics: process.env.NODE_ENV === 'development' ? {
          roles: ctx.roles,
          employeeId: ctx.employeeId,
          viewedEmployeeId: employee.id,
          departmentIds: ctx.departmentIds || [],
          isOwner: ctx.isOwner,
          canEditFlags: {
            PERSONAL: sectionsMap.PERSONAL.canEdit,
            EMPLOYMENT: sectionsMap.EMPLOYMENT.canEdit,
            FINANCIAL: sectionsMap.FINANCIAL.canEdit,
            CONTRACT: sectionsMap.CONTRACT.canEdit,
          },
          editReasons: {
            PERSONAL: sectionsMap.PERSONAL.editReason,
            EMPLOYMENT: sectionsMap.EMPLOYMENT.editReason,
            FINANCIAL: sectionsMap.FINANCIAL.editReason,
            CONTRACT: sectionsMap.CONTRACT.editReason,
          },
        } : undefined,
      });
    } catch (error: any) {
      logger.error('[CVision Employee Profile GET]', error?.message || String(error), error?.stack);
      
      // Check if it's an authz error that wasn't caught
      if (error.message?.includes('FORBIDDEN') || error.message?.includes('UNAUTHORIZED')) {
        return NextResponse.json(
          { error: error.message || 'Access denied', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { error: 'Internal server error', message: error.message, code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);
