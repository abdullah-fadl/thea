import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Diagnostics API
 * GET /api/cvision/diagnostics - Get database counts and IDs for current tenant
 * 
 * Dev-only endpoint for debugging tenant data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type {
  CVisionJobRequisition,
  CVisionCandidate,
  CVisionCandidateDocument,
  CVisionCvParseJob,
  CVisionPayrollProfile,
  CVisionPayrollRun,
  CVisionPayslip,
  CVisionLoan,
  CVisionEmployee,
} from '@/lib/cvision/types';
import { hasTenantWideAccess } from '@/lib/cvision/authz/context';
import { CANON_STATUSES } from '@/lib/cvision/status';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get diagnostics
export const GET = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      // Build authz context for diagnostics
      const { getAuthzContext } = await import('@/lib/cvision/authz/context');
      const { requireAuth } = await import('@/lib/auth/requireAuth');
      const authResult = await requireAuth(request);
      let authzCtx = null;
      if (!(authResult instanceof NextResponse)) {
        authzCtx = await getAuthzContext(request, authResult);
      }
      logger.info('[CVision Diagnostics GET]', {
        tenantId,
        userId,
        role,
      });

      const requisitionCollection = await getCVisionCollection<CVisionJobRequisition>(
        tenantId,
        'jobRequisitions'
      );
      const candidateCollection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );
      const documentCollection = await getCVisionCollection<CVisionCandidateDocument>(
        tenantId,
        'candidateDocuments'
      );
      const parseJobCollection = await getCVisionCollection<CVisionCvParseJob>(
        tenantId,
        'cvParseJobs'
      );

      // Payroll collections
      const payrollProfileCollection = await getCVisionCollection<CVisionPayrollProfile>(
        tenantId,
        'payrollProfiles'
      );
      const payrollRunCollection = await getCVisionCollection<CVisionPayrollRun>(
        tenantId,
        'payrollRuns'
      );
      const payslipCollection = await getCVisionCollection<CVisionPayslip>(
        tenantId,
        'payslips'
      );
      const loanCollection = await getCVisionCollection<CVisionLoan>(
        tenantId,
        'loans'
      );
      const employeeCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );

      // Get counts and last 3 IDs for each collection
      const [
        requisitions,
        candidates,
        documents,
        parseJobs,
        payrollProfiles,
        payrollRuns,
        payslips,
        loans,
      ] = await Promise.all([
        requisitionCollection
          .find(createTenantFilter(tenantId))
          .sort({ createdAt: -1 })
          .limit(3)
          .toArray(),
        candidateCollection
          .find(createTenantFilter(tenantId))
          .sort({ createdAt: -1 })
          .limit(3)
          .toArray(),
        documentCollection
          .find(createTenantFilter(tenantId))
          .sort({ createdAt: -1 })
          .limit(3)
          .toArray(),
        parseJobCollection
          .find(createTenantFilter(tenantId))
          .sort({ createdAt: -1 })
          .limit(3)
          .toArray(),
        payrollProfileCollection
          .find(createTenantFilter(tenantId))
          .sort({ createdAt: -1 })
          .limit(3)
          .toArray(),
        payrollRunCollection
          .find(createTenantFilter(tenantId))
          .sort({ createdAt: -1 })
          .limit(3)
          .toArray(),
        payslipCollection
          .find(createTenantFilter(tenantId))
          .sort({ createdAt: -1 })
          .limit(3)
          .toArray(),
        loanCollection
          .find(createTenantFilter(tenantId))
          .sort({ createdAt: -1 })
          .limit(3)
          .toArray(),
      ]);

      // Build employee counts with scope awareness
      const hasTenantAccess = authzCtx ? hasTenantWideAccess(authzCtx) : false;
      let employeeFilter: Record<string, any> = createTenantFilter(tenantId);
      
      if (!hasTenantAccess && authzCtx) {
        // Apply scope filter similar to employees list endpoint
        if (authzCtx.departmentIds && authzCtx.departmentIds.length > 0) {
          const orConditions: any[] = [
            { departmentId: { $in: authzCtx.departmentIds } },
          ];
          if (authzCtx.employeeId) {
            orConditions.push({ id: authzCtx.employeeId });
          }
          employeeFilter = { ...employeeFilter, $or: orConditions };
        } else if (authzCtx.employeeId) {
          employeeFilter = { ...employeeFilter, id: authzCtx.employeeId };
        }
      }

      const [
        requisitionsCount,
        candidatesCount,
        documentsCount,
        parseJobsCount,
        payrollProfilesCount,
        payrollRunsCount,
        payslipsCount,
        loansCount,
        totalEmployeesCount,
        visibleEmployeesCount,
        activeEmployeesCount,
        probationEmployeesCount,
        resignedEmployeesCount,
        terminatedEmployeesCount,
        archivedEmployeesCount,
      ] = await Promise.all([
        requisitionCollection.countDocuments(createTenantFilter(tenantId)),
        candidateCollection.countDocuments(createTenantFilter(tenantId)),
        documentCollection.countDocuments(createTenantFilter(tenantId)),
        parseJobCollection.countDocuments(createTenantFilter(tenantId)),
        payrollProfileCollection.countDocuments(createTenantFilter(tenantId)),
        payrollRunCollection.countDocuments(createTenantFilter(tenantId)),
        payslipCollection.countDocuments(createTenantFilter(tenantId)),
        loanCollection.countDocuments(createTenantFilter(tenantId)),
        // Employee counts (using canonical uppercase status values)
        employeeCollection.countDocuments(createTenantFilter(tenantId)),
        employeeCollection.countDocuments(employeeFilter),
        employeeCollection.countDocuments({ ...employeeFilter, status: 'ACTIVE' }),
        employeeCollection.countDocuments({ ...employeeFilter, status: 'PROBATION' }),
        employeeCollection.countDocuments({ ...employeeFilter, status: 'RESIGNED' }),
        employeeCollection.countDocuments({ ...employeeFilter, status: 'TERMINATED' }),
        employeeCollection.countDocuments({ ...employeeFilter, isArchived: true }),
      ]);

      logger.info('[CVision Diagnostics GET] Result:', {
        tenantId,
        requisitionsCount,
        candidatesCount,
        documentsCount,
        parseJobsCount,
        payrollProfilesCount,
        payrollRunsCount,
        payslipsCount,
        loansCount,
      });

      return NextResponse.json({
        success: true,
        data: {
          tenantId,
          userId,
          roles: authzCtx?.roles || (role ? [role] : []),
          employeeId: authzCtx?.employeeId || null,
          departmentIds: authzCtx?.departmentIds || [],
          employeeStatus: authzCtx?.employeeStatus || null,
          hasTenantWideAccess: hasTenantAccess,
          employees: {
            totalInTenant: totalEmployeesCount,
            visibleByScope: visibleEmployeesCount,
            byStatus: {
              active: activeEmployeesCount,
              probation: probationEmployeesCount,
              resigned: resignedEmployeesCount,
              terminated: terminatedEmployeesCount,
            },
            archived: archivedEmployeesCount,
          },
          requisitions: {
            count: requisitionsCount,
            ids: requisitions.map((r) => r.id),
          },
          candidates: {
            count: candidatesCount,
            ids: candidates.map((c) => c.id),
          },
          documents: {
            count: documentsCount,
            ids: documents.map((d) => d.id),
          },
          parseJobs: {
            count: parseJobsCount,
            ids: parseJobs.map((j) => j.id),
          },
          payrollProfiles: {
            count: payrollProfilesCount,
            ids: payrollProfiles.map((p) => p.id),
          },
          payrollRuns: {
            count: payrollRunsCount,
            ids: payrollRuns.map((r) => r.id),
          },
          payslips: {
            count: payslipsCount,
            ids: payslips.map((p) => p.id),
          },
          loans: {
            count: loansCount,
            ids: loans.map((l) => l.id),
          },
        },
      });
    } catch (error: any) {
      logger.error('[CVision Diagnostics GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.VIEW }
);
