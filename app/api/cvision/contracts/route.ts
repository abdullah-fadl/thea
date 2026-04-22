import { logger } from '@/lib/monitoring/logger';
// app/api/cvision/contracts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  calculateNoticePeriod,
  validateContract,
  checkRenewalEligibility,
  generateContractSummary,
  SAUDI_CONTRACT_RULES,
} from '@/lib/cvision/contracts';

// GET /api/cvision/contracts - List contracts
export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);

      const employeeId = searchParams.get('employeeId');
      const status = searchParams.get('status');
      const type = searchParams.get('type');
      const action = searchParams.get('action');

      const db = await getCVisionDb(tenantId);

      // Get contract rules
      if (action === 'rules') {
        return NextResponse.json({
          success: true,
          data: {
            rules: SAUDI_CONTRACT_RULES,
            description: {
              PROBATION_MAX_DAYS: 'Maximum probation period (days)',
              PROBATION_EXTENSION_DAYS: 'Probation extension (days)',
              NOTICE_PERIOD_UNLIMITED: 'Notice period for unlimited contract (days)',
              NOTICE_PERIOD_LIMITED: 'Notice period for limited contract (days)',
              MAX_FIXED_TERM_YEARS: 'Maximum fixed-term contract (years)',
              AUTO_RENEWAL_TO_UNLIMITED: 'Renewals before converting to unlimited',
              MIN_VACATION_DAYS: 'Minimum annual vacation (days)',
            },
          },
        });
      }

      // Contracts expiring soon
      if (action === 'expiring-soon') {
        const thirtyDaysLater = new Date();
        thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

        const expiringContracts = await db.collection('cvision_contracts').find({
          tenantId,
          status: 'ACTIVE',
          endDate: { $lte: thirtyDaysLater, $gte: new Date() },
          deletedAt: null,
        }).limit(5000).toArray();

        return NextResponse.json({
          success: true,
          data: {
            contracts: expiringContracts,
            total: expiringContracts.length,
          },
        });
      }

      // Employees in probation
      if (action === 'in-probation') {
        const today = new Date();

        const probationContracts = await db.collection('cvision_contracts').find({
          tenantId,
          status: 'ACTIVE',
          probationEndDate: { $gte: today },
          deletedAt: null,
        }).limit(5000).toArray();

        return NextResponse.json({
          success: true,
          data: {
            contracts: probationContracts,
            total: probationContracts.length,
          },
        });
      }

      // Employee contract summary
      if (action === 'summary' && employeeId) {
        const contract = await db.collection('cvision_contracts').findOne({
          tenantId,
          employeeId,
          status: 'ACTIVE',
          deletedAt: null,
        });

        if (!contract) {
          return NextResponse.json(
            { success: false, error: 'No active contract found for this employee' },
            { status: 404 }
          );
        }

        const summary = generateContractSummary(employeeId, {
          type: contract.type,
          startDate: contract.startDate,
          endDate: contract.endDate,
          probationEndDate: (contract as Record<string, unknown>).probationEndDate as Date | undefined,
          basicSalary: contract.basicSalary,
          housingAllowance: contract.housingAllowance,
          transportAllowance: contract.transportAllowance,
          otherAllowances: contract.otherAllowances,
          workingHoursPerWeek: contract.workingHoursPerWeek,
          vacationDaysPerYear: contract.vacationDaysPerYear,
          noticePeriodDays: contract.noticePeriodDays,
        });

        return NextResponse.json({
          success: true,
          data: { contract, summary },
        });
      }

      // Build query
      const query: any = { tenantId, deletedAt: null };

      if (employeeId) query.employeeId = employeeId;
      if (status) {
        query.status = status;
      } else {
        // By default, exclude EXPIRED contracts unless explicitly requested
        query.status = { $ne: 'EXPIRED' };
      }
      if (type) query.type = type;

      const contracts = await db.collection('cvision_contracts')
        .find(query)
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();

      // Fetch employee data and enrich contracts
      const employeeIds = [...new Set(contracts.map((c: any) => c.employeeId).filter(Boolean))];
      const employees = employeeIds.length > 0
        ? await db.collection('cvision_employees')
            .find({ tenantId, id: { $in: employeeIds }, deletedAt: null })
            .limit(5000)
            .toArray()
        : [];

      const employeeMap = new Map(employees.map((e: any) => [e.id, e]));

      // Fetch departments
      const departmentIds = [...new Set(employees.map((e: any) => e.departmentId).filter(Boolean))];
      const departments = departmentIds.length > 0
        ? await db.collection('cvision_departments')
            .find({ tenantId, id: { $in: departmentIds } })
            .limit(5000)
            .toArray()
        : [];

      const deptMap = new Map(departments.map((d: any) => [d.id, d]));

      // Enrich contracts with employee and department names
      const enrichedContracts = contracts.map((contract: any) => {
        const employee = employeeMap.get(contract.employeeId);
        const department = employee ? deptMap.get(employee.departmentId) : null;

        return {
          ...contract,
          employeeName: employee
            ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email
            : null,
          departmentName: department?.name || null,
        };
      });

      return NextResponse.json({
        success: true,
        data: enrichedContracts,
        total: enrichedContracts.length,
      });

    } catch (error) {
      logger.error('Contracts API Error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);

// POST /api/cvision/contracts - Create new contract
export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId }) => {
    try {
      const body = await request.json();
      const { action } = body;

      const db = await getCVisionDb(tenantId);

      // Validate contract
      if (action === 'validate') {
        const validation = validateContract({
          type: body.type,
          startDate: new Date(body.startDate),
          endDate: body.endDate ? new Date(body.endDate) : undefined,
          probationEndDate: body.probationEndDate ? new Date(body.probationEndDate) : undefined,
          basicSalary: body.basicSalary,
          housingAllowance: body.housingAllowance || 0,
          transportAllowance: body.transportAllowance || 0,
          otherAllowances: body.otherAllowances || 0,
          workingHoursPerWeek: body.workingHoursPerWeek || 48,
          vacationDaysPerYear: body.vacationDaysPerYear || 21,
          noticePeriodDays: body.noticePeriodDays || 30,
        });

        return NextResponse.json({
          success: true,
          data: validation,
        });
      }

      // Calculate notice period
      if (action === 'calculate-notice') {
        const { contractType, resignationDate, dailySalary, isInProbation = false } = body;

        const noticePeriod = calculateNoticePeriod(
          contractType,
          new Date(resignationDate),
          dailySalary,
          isInProbation
        );

        return NextResponse.json({
          success: true,
          data: noticePeriod,
        });
      }

      // Check renewal eligibility
      if (action === 'check-renewal') {
        const { contractId } = body;

        const contract = await db.collection('cvision_contracts').findOne({
          _id: contractId,
          tenantId,
        });

        if (!contract) {
          return NextResponse.json(
            { success: false, error: 'Contract not found' },
            { status: 404 }
          );
        }

        const renewalEligibility = checkRenewalEligibility(
          contract.type,
          contract.endDate,
          contract.renewalCount || 0
        );

        return NextResponse.json({
          success: true,
          data: renewalEligibility,
        });
      }

      // Terminate contract
      if (action === 'terminate') {
        const { contractId } = body;

        const contract = await db.collection('cvision_contracts').findOne({
          $or: [{ _id: contractId }, { id: contractId }],
          tenantId,
        });

        if (!contract) {
          return NextResponse.json(
            { success: false, error: 'Contract not found' },
            { status: 404 }
          );
        }

        if (contract.status !== 'ACTIVE') {
          return NextResponse.json(
            { success: false, error: 'Only active contracts can be terminated' },
            { status: 400 }
          );
        }

        // Update contract status to TERMINATED
        await db.collection('cvision_contracts').updateOne(
          { tenantId, $or: [{ _id: contractId }, { id: contractId }] },
          {
            $set: {
              status: 'TERMINATED',
              terminatedAt: new Date(),
              updatedAt: new Date(),
              updatedBy: userId,
            },
          }
        );

        return NextResponse.json({
          success: true,
          message: 'Contract terminated successfully',
        });
      }

      // Renew contract
      if (action === 'renew') {
        const { contractId, newEndDate } = body;

        const contract = await db.collection('cvision_contracts').findOne({
          _id: contractId,
          tenantId,
        });

        if (!contract) {
          return NextResponse.json(
            { success: false, error: 'Contract not found' },
            { status: 404 }
          );
        }

        const renewalCount = (contract.renewalCount || 0) + 1;
        const willConvertToUnlimited = renewalCount >= SAUDI_CONTRACT_RULES.AUTO_RENEWAL_TO_UNLIMITED;

        // Update current contract
        await db.collection('cvision_contracts').updateOne(
          { _id: contractId, tenantId },
          {
            $set: {
              status: willConvertToUnlimited ? 'ACTIVE' : 'RENEWED',
              type: willConvertToUnlimited ? 'PERMANENT' : contract.type,
              endDate: willConvertToUnlimited ? null : new Date(newEndDate),
              renewalCount,
              updatedAt: new Date(),
              updatedBy: userId,
            },
          }
        );

        return NextResponse.json({
          success: true,
          message: willConvertToUnlimited
            ? 'Contract converted to unlimited term'
            : 'Contract renewed successfully',
          data: {
            renewalCount,
            convertedToUnlimited: willConvertToUnlimited,
          },
        });
      }

      // Create new contract
      const {
        employeeId,
        type,
        startDate,
        endDate,
        probationEndDate,
        basicSalary,
        housingAllowance = 0,
        transportAllowance = 0,
        otherAllowances = 0,
        workingHoursPerWeek = 48,
        vacationDaysPerYear = 21,
        noticePeriodDays = 30,
        notes,
      } = body;

      if (!employeeId || !type || !startDate || !basicSalary) {
        return NextResponse.json(
          { success: false, error: 'All required fields must be filled' },
          { status: 400 }
        );
      }

      // Check if employee exists
      const employee = await db.collection('cvision_employees').findOne({
        id: employeeId,
        tenantId,
      });

      if (!employee) {
        return NextResponse.json(
          { success: false, error: 'Employee not found' },
          { status: 404 }
        );
      }

      // Expire any active previous contracts
      await db.collection('cvision_contracts').updateMany(
        { tenantId, employeeId, status: 'ACTIVE' },
        { $set: { status: 'EXPIRED', updatedAt: new Date(), updatedBy: userId } }
      );

      // Calculate default probation end date if not specified
      const start = new Date(startDate);
      const defaultProbationEnd = new Date(start);
      defaultProbationEnd.setDate(defaultProbationEnd.getDate() + SAUDI_CONTRACT_RULES.PROBATION_MAX_DAYS);

      // Generate contract number
      const contractCount = await db.collection('cvision_contracts').countDocuments({ tenantId });
      const contractNumber = `CNT-${new Date().getFullYear()}-${String(contractCount + 1).padStart(5, '0')}`;

      // PG columns: id, tenantId, contractNo, employeeId, type, status, startDate, endDate,
      // basicSalary, housingAllowance, transportAllowance, otherAllowances, vacationDaysPerYear,
      // isActive, renewedFromContractId, terminationDate, terminationReason,
      // createdAt, updatedAt, createdBy, updatedBy, deletedAt
      // NOT in PG (stripped): contractNumber → use contractNo, probationEndDate,
      // workingHoursPerWeek, noticePeriodDays, renewalCount, signedAt, signedByEmployee,
      // signedByEmployer, documentUrl, notes
      const contract = {
        tenantId,
        employeeId,
        contractNo: contractNumber, // PG column is 'contractNo', not 'contractNumber'
        type,
        status: 'ACTIVE',
        startDate: start,
        endDate: endDate ? new Date(endDate) : null,
        basicSalary,
        housingAllowance,
        transportAllowance,
        otherAllowances,
        vacationDaysPerYear,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
        deletedAt: null,
      };

      // Validate contract
      const validation = validateContract({
        type,
        startDate: start,
        endDate: endDate ? new Date(endDate) : undefined,
        probationEndDate: (contract as Record<string, unknown>).probationEndDate as any,
        basicSalary,
        housingAllowance,
        transportAllowance,
        otherAllowances,
        workingHoursPerWeek,
        vacationDaysPerYear,
        noticePeriodDays,
      });

      if (!validation.isValid) {
        return NextResponse.json(
          { success: false, error: validation.errors.join(', ') },
          { status: 400 }
        );
      }

      const result = await db.collection('cvision_contracts').insertOne(contract);

      // Update employee metadata with contract reference.
      // currentContractId, basicSalary, housingAllowance, transportAllowance are
      // NOT PG columns on cvision_employees — store in metadata JSONB.
      const empDoc = await db.collection('cvision_employees').findOne({ id: employeeId, tenantId });
      const existingMeta = ((empDoc as Record<string, unknown>)?.metadata || {}) as Record<string, unknown>;
      await db.collection('cvision_employees').updateOne(
        { id: employeeId, tenantId },
        {
          $set: {
            metadata: {
              ...existingMeta,
              currentContractId: result.insertedId,
              basicSalary,
              housingAllowance,
              transportAllowance,
            },
            updatedAt: new Date(),
            updatedBy: userId,
          },
        }
      );

      return NextResponse.json({
        success: true,
        data: { id: result.insertedId, ...contract },
        message: 'Contract created successfully',
        warnings: validation.warnings,
      });

    } catch (error) {
      logger.error('Contracts API Error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);
