import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Fix Employee Profile API
 * POST /api/cvision/employees/:id/fix-profile
 *
 * Creates missing profile sections for employees who were hired
 * before profile sections were implemented.
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
import type { CVisionEmployee, CVisionContract } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  async (request, { tenantId, userId }, params) => {
    try {
      const resolvedParams = await params;
      const employeeId = resolvedParams?.id as string;

      if (!employeeId) {
        return NextResponse.json(
          { error: 'Employee ID is required' },
          { status: 400 }
        );
      }

      // Get employee
      const employeeCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );
      const employee = await findById(employeeCollection, tenantId, employeeId);

      if (!employee) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        );
      }

      // Get contract if exists
      const contractCollection = await getCVisionCollection<CVisionContract>(
        tenantId,
        'contracts'
      );
      const contract = await contractCollection.findOne(
        createTenantFilter(tenantId, { employeeId })
      );

      // Check existing profile sections
      const profileSectionsCollection = await getCVisionCollection<any>(
        tenantId,
        'employeeProfileSections'
      );

      const existingSections = await profileSectionsCollection
        .find(createTenantFilter(tenantId, { employeeId }))
        .toArray();

      const existingKeys = existingSections.map((s: any) => s.sectionKey);
      const now = new Date();
      const createdSections: string[] = [];

      // Create PERSONAL section if missing
      if (!existingKeys.includes('PERSONAL')) {
        await profileSectionsCollection.insertOne({
          id: uuidv4(),
          tenantId,
          employeeId,
          sectionKey: 'PERSONAL',
          schemaVersion: 1,
          dataJson: {
            firstName: employee.firstName,
            lastName: employee.lastName,
            fullName: employee.fullName || `${employee.firstName} ${employee.lastName}`,
            email: employee.email || null,
            phone: employee.phone || null,
          },
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
        });
        createdSections.push('PERSONAL');
      }

      // Create EMPLOYMENT section if missing
      if (!existingKeys.includes('EMPLOYMENT')) {
        await profileSectionsCollection.insertOne({
          id: uuidv4(),
          tenantId,
          employeeId,
          sectionKey: 'EMPLOYMENT',
          schemaVersion: 1,
          dataJson: {
            departmentId: employee.departmentId || null,
            jobTitleId: employee.jobTitleId || null,
            positionId: employee.positionId || null,
            managerEmployeeId: employee.managerEmployeeId || null,
            gradeId: employee.gradeId || null,
            hiredAt: employee.hiredAt ? new Date(employee.hiredAt).toISOString() : null,
          },
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
        });
        createdSections.push('EMPLOYMENT');
      }

      // Create FINANCIAL section if missing
      if (!existingKeys.includes('FINANCIAL')) {
        await profileSectionsCollection.insertOne({
          id: uuidv4(),
          tenantId,
          employeeId,
          sectionKey: 'FINANCIAL',
          schemaVersion: 1,
          dataJson: {
            basicSalary: contract?.basicSalary || 0,
            housingAllowance: contract?.housingAllowance || 0,
            transportAllowance: contract?.transportAllowance || 0,
            bankName: null,
            bankAccountNumber: null,
            iban: null,
          },
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
        });
        createdSections.push('FINANCIAL');
      }

      // Create CONTRACT section if missing
      if (!existingKeys.includes('CONTRACT')) {
        await profileSectionsCollection.insertOne({
          id: uuidv4(),
          tenantId,
          employeeId,
          sectionKey: 'CONTRACT',
          schemaVersion: 1,
          dataJson: {
            contractId: contract?.id || null,
            contractNo: contract?.contractNo || null,
            contractType: contract?.type || 'FIXED_TERM',
            startDate: contract?.startDate ? new Date(contract.startDate).toISOString() : null,
            endDate: contract?.endDate ? new Date(contract.endDate).toISOString() : null,
            probationEndDate: null,
            vacationDaysPerYear: contract?.vacationDaysPerYear || 21,
          },
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
        });
        createdSections.push('CONTRACT');
      }

      if (createdSections.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'All profile sections already exist',
          createdSections: [],
        });
      }

      return NextResponse.json({
        success: true,
        message: `Created ${createdSections.length} missing profile section(s)`,
        createdSections,
        employee: {
          id: employee.id,
          fullName: employee.fullName,
        },
      });
    } catch (error: any) {
      logger.error('[Fix Profile]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);
