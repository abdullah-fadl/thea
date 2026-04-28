import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Payroll Profiles API
 * GET /api/cvision/payroll/profiles - List profiles
 * POST /api/cvision/payroll/profiles - Create profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
  paginatedList,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type {
  CVisionPayrollProfile,
  CVisionEmployee,
} from '@/lib/cvision/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createProfileSchema = z.object({
  employeeId: z.string().uuid(),
  baseSalary: z.number().min(0),
  // Accept either structured allowancesJson or individual allowance fields
  allowancesJson: z.record(z.string(), z.number()).optional(),
  deductionsJson: z.record(z.string(), z.number()).optional(),
  // Individual allowance fields (mapped into allowancesJson if provided)
  housingAllowance: z.number().optional(),
  transportAllowance: z.number().optional(),
  otherAllowances: z.number().optional(),
  // Banking info
  currency: z.string().optional(),
  bankName: z.string().optional(),
  iban: z.string().optional(),
}).transform((data) => {
  // Build allowancesJson from individual fields if not provided directly
  const allowancesJson: Record<string, number> = data.allowancesJson || {};
  if (data.housingAllowance !== undefined) allowancesJson.housing = data.housingAllowance;
  if (data.transportAllowance !== undefined) allowancesJson.transport = data.transportAllowance;
  if (data.otherAllowances !== undefined) allowancesJson.other = data.otherAllowances;
  return {
    employeeId: data.employeeId,
    baseSalary: data.baseSalary,
    allowancesJson: allowancesJson,
    deductionsJson: data.deductionsJson || ({} as Record<string, number>),
    bankIban: data.iban,
    currency: data.currency,
    bankName: data.bankName,
  };
});

// GET - List payroll profiles
export const GET = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const employeeId = searchParams.get('employeeId');

      const collection = await getCVisionCollection<CVisionPayrollProfile>(
        tenantId,
        'payrollProfiles'
      );

      const query: any = createTenantFilter(tenantId, { isArchived: { $ne: true } });
      if (employeeId) {
        query.employeeId = employeeId;
      }

      const profiles = await collection.find(query).sort({ createdAt: -1 }).limit(5000).toArray();

      // Enrich with employee names
      const employeeIds = [...new Set(profiles.map(p => p.employeeId).filter(Boolean))];
      const empCollection = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
      const employees = employeeIds.length > 0
        ? await empCollection.find({ tenantId, id: { $in: employeeIds } }).limit(5000).toArray()
        : [];

      const deptCollection = await getCVisionCollection<any>(tenantId, 'departments');
      const departments = await deptCollection.find({ tenantId }).limit(500).toArray();

      const employeeMap = new Map(employees.map(e => [e.id, e]));
      const deptMap = new Map(departments.map(d => [d.id, d]));

      const enrichedProfiles = profiles.map(profile => {
        const employee = employeeMap.get(profile.employeeId);
        const dept = employee?.departmentId ? deptMap.get(employee.departmentId) : null;
        return {
          ...profile,
          id: profile.id || (profile as Record<string, unknown>)._id?.toString(),
          employeeName: employee
            ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
            : null,
          employeeNumber: employee?.employeeNo || null,
          departmentId: employee?.departmentId || null,
          departmentName: dept?.name || null,
        };
      });

      return NextResponse.json({
        success: true,
        profiles: enrichedProfiles,
        total: enrichedProfiles.length,
      });
    } catch (error: any) {
      logger.error('[CVision Payroll Profiles GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_READ }
);

// POST - Create payroll profile
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const data = createProfileSchema.parse(body);

      const collection = await getCVisionCollection<CVisionPayrollProfile>(
        tenantId,
        'payrollProfiles'
      );

      // Check if profile already exists for this employee
      const existing = await collection.findOne(
        createTenantFilter(tenantId, {
          employeeId: data.employeeId,
          isArchived: { $ne: true },
        })
      );

      if (existing) {
        return NextResponse.json(
          {
            error: 'Profile already exists',
            message: 'This employee already has a payroll profile',
          },
          { status: 409 }
        );
      }

      // Verify employee exists
      const empCollection = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
      const employee = await empCollection.findOne(
        createTenantFilter(tenantId, { id: data.employeeId })
      );

      if (!employee) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        );
      }

      const now = new Date();
      const profile: CVisionPayrollProfile = {
        id: uuidv4(),
        tenantId,
        employeeId: data.employeeId,
        baseSalary: data.baseSalary,
        allowancesJson: data.allowancesJson,
        deductionsJson: data.deductionsJson,
        bankIban: data.bankIban || null,
        isActive: true,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      await collection.insertOne(profile);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role: role || 'unknown', tenantId, user }, request),
        'payroll_profile_create',
        'PAYROLL_PROFILE',
        {
          resourceId: profile.id,
          metadata: {
            employeeId: data.employeeId,
            baseSalary: data.baseSalary,
          },
        }
      );

      return NextResponse.json({
        success: true,
        profile,
      });
    } catch (error: any) {
      logger.error('[CVision Payroll Profiles POST]', error?.message || String(error));
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_WRITE }
);
