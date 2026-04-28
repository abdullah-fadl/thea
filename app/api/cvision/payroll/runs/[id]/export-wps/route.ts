import { logger } from '@/lib/monitoring/logger';
/**
 * CVision WPS Export API
 * POST /api/cvision/payroll/runs/:id/export-wps
 * 
 * Generates WPS (Wage Protection System) CSV export for approved payroll run.
 * Stores export metadata in database.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
  findById,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type {
  CVisionPayrollRun,
  CVisionPayslip,
  CVisionEmployee,
  CVisionPayrollProfile,
  CVisionPayrollExport,
} from '@/lib/cvision/types';
import {
  generateWpsExport,
  validateWpsExport,
} from '@/lib/cvision/payroll/wps-export';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST - Export WPS CSV
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const runId = resolvedParams?.id as string;

      if (!runId) {
        return NextResponse.json(
          { error: 'Run ID is required' },
          { status: 400 }
        );
      }

      const runCollection = await getCVisionCollection<CVisionPayrollRun>(
        tenantId,
        'payrollRuns'
      );
      const run = await findById(runCollection, tenantId, runId);

      if (!run) {
        return NextResponse.json(
          { error: 'Payroll run not found' },
          { status: 404 }
        );
      }

      // Only allow export for approved runs
      if (run.status !== 'APPROVED') {
        return NextResponse.json(
          {
            error: 'Invalid status',
            message: `Can only export APPROVED runs. Current status: ${run.status}`,
          },
          { status: 400 }
        );
      }

      // Get payslips for this run
      const payslipCollection = await getCVisionCollection<CVisionPayslip>(
        tenantId,
        'payslips'
      );
      const payslips = await payslipCollection
        .find(createTenantFilter(tenantId, { runId }))
        .toArray();

      if (payslips.length === 0) {
        return NextResponse.json(
          {
            error: 'No payslips found',
            message: 'Cannot export: no payslips found for this run',
          },
          { status: 400 }
        );
      }

      // Get employees and profiles
      const empCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );
      const profileCollection = await getCVisionCollection<CVisionPayrollProfile>(
        tenantId,
        'payrollProfiles'
      );

      // Fetch all employees and profiles
      const employeeIds = [...new Set(payslips.map((p) => p.employeeId))];
      const employees = await empCollection
        .find(createTenantFilter(tenantId, { id: { $in: employeeIds } }))
        .toArray();
      const profiles = await profileCollection
        .find(createTenantFilter(tenantId, { employeeId: { $in: employeeIds }, isActive: true }))
        .toArray();

      // Create maps for quick lookup
      const employeeMap = new Map<string, CVisionEmployee>();
      for (const emp of employees) {
        employeeMap.set(emp.id, emp);
      }

      const profileMap = new Map<string, CVisionPayrollProfile>();
      for (const profile of profiles) {
        profileMap.set(profile.employeeId, profile);
      }

      // Validate export data
      const validation = validateWpsExport(payslips, employeeMap, profileMap);
      if (!validation.valid) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            message: 'Some payslips have missing or invalid data',
            details: validation.errors,
          },
          { status: 400 }
        );
      }

      // Generate WPS export
      const exportResult = generateWpsExport(run, payslips, employeeMap, profileMap);

      // Store export metadata in database
      const exportCollection = await getCVisionCollection<CVisionPayrollExport>(
        tenantId,
        'payrollExports'
      );

      const now = new Date();
      const exportRecord = {
        id: uuidv4(),
        tenantId,
        runId,
        format: 'WPS',
        fileName: exportResult.fileName,
        fileSize: Buffer.byteLength(exportResult.csvContent, 'utf8'),
        rowCount: exportResult.rowCount,
        checksum: exportResult.checksum,
        exportedAt: now,
        exportedBy: userId,
        metadata: {
          period: run.period,
          totalGross: (run.totals || run.totalsJson)?.totalGross,
          totalNet: (run.totals || run.totalsJson)?.totalNet,
          employeeCount: (run.totals || run.totalsJson)?.employeeCount,
        },
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      await exportCollection.insertOne(exportRecord);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role: role || 'unknown', tenantId, user }, request),
        'payroll_run_export_wps',
        'PAYROLL_RUN',
        {
          resourceId: exportRecord.id,
          metadata: {
            runId,
            format: 'WPS',
            fileName: exportResult.fileName,
            rowCount: exportResult.rowCount,
          },
        }
      );

      // Return CSV content with appropriate headers
      return new NextResponse(exportResult.csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${exportResult.fileName}"`,
          'Content-Length': String(exportRecord.fileSize),
        },
      });
    } catch (error: any) {
      logger.error('[CVision WPS Export POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_WRITE }
);
