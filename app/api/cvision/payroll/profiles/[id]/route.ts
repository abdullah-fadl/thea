import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Payroll Profile API
 * PATCH /api/cvision/payroll/profiles/:id - Update profile
 * DELETE /api/cvision/payroll/profiles/:id - Archive profile
 */

import { NextRequest, NextResponse } from 'next/server';
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
import type { CVisionPayrollProfile } from '@/lib/cvision/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const updateProfileSchema = z.object({
  baseSalary: z.number().min(0).optional(),
  allowancesJson: z.record(z.string(), z.number()).optional(),
  deductionsJson: z.record(z.string(), z.number()).optional(),
  isActive: z.boolean().optional(),
});

// PATCH - Update profile
export const PATCH = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const profileId = resolvedParams?.id as string;

      if (!profileId) {
        return NextResponse.json(
          { error: 'Profile ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = updateProfileSchema.parse(body);

      const collection = await getCVisionCollection<CVisionPayrollProfile>(
        tenantId,
        'payrollProfiles'
      );

      const existing = await findById(collection, tenantId, profileId);
      if (!existing) {
        return NextResponse.json(
          { error: 'Profile not found' },
          { status: 404 }
        );
      }

      const updateData: any = {
        updatedAt: new Date(),
        updatedBy: userId,
      };

      if (data.baseSalary !== undefined) updateData.baseSalary = data.baseSalary;
      if (data.allowancesJson !== undefined) updateData.allowancesJson = data.allowancesJson;
      if (data.deductionsJson !== undefined) updateData.deductionsJson = data.deductionsJson;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      await collection.updateOne(
        createTenantFilter(tenantId, { id: profileId }),
        { $set: updateData }
      );

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role: role || 'unknown', tenantId, user }, request),
        'payroll_profile_update',
        'PAYROLL_PROFILE',
        {
          resourceId: profileId,
          changes: {
            before: {
              baseSalary: existing.baseSalary,
              allowancesJson: existing.allowancesJson,
              deductionsJson: existing.deductionsJson,
            },
            after: updateData,
          },
        }
      );

      return NextResponse.json({
        success: true,
        profile: { ...existing, ...updateData },
      });
    } catch (error: any) {
      logger.error('[CVision Payroll Profile PATCH]', error?.message || String(error));
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

// DELETE - Archive profile
export const DELETE = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const profileId = resolvedParams?.id as string;

      if (!profileId) {
        return NextResponse.json(
          { error: 'Profile ID is required' },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionPayrollProfile>(
        tenantId,
        'payrollProfiles'
      );

      const existing = await findById(collection, tenantId, profileId);
      if (!existing) {
        return NextResponse.json(
          { error: 'Profile not found' },
          { status: 404 }
        );
      }

      await collection.updateOne(
        createTenantFilter(tenantId, { id: profileId }),
        {
          $set: {
            isArchived: true,
            isActive: false,
            updatedAt: new Date(),
            updatedBy: userId,
          },
        }
      );

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role: role || 'unknown', tenantId, user }, request),
        'payroll_profile_archive',
        'PAYROLL_PROFILE',
        {
          resourceId: profileId,
          metadata: { employeeId: existing.employeeId },
        }
      );

      return NextResponse.json({
        success: true,
        message: 'Profile archived',
      });
    } catch (error: any) {
      logger.error('[CVision Payroll Profile DELETE]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_WRITE }
);
