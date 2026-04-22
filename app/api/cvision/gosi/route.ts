import { logger } from '@/lib/monitoring/logger';
// app/api/cvision/gosi/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  calculateGOSI,
  calculateEndOfService,
  calculateNitaqat,
  GOSI_RATES
} from '@/lib/cvision/gosi';

// GET /api/cvision/gosi - Get GOSI insurance rates
export const GET = withAuthTenant(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Return current rates
    if (action === 'rates') {
      return NextResponse.json({
        success: true,
        data: {
          rates: GOSI_RATES,
          description: {
            EMPLOYEE_RATE: 'Employee contribution rate',
            EMPLOYER_RATE: 'Employer contribution rate',
            HAZARD_RATE: 'Occupational hazard rate (employer)',
            MAX_SALARY: 'Maximum salary subject to GOSI',
            MIN_SALARY: 'Minimum salary',
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Use POST to calculate GOSI contributions or end of service',
        endpoints: {
          'POST /api/cvision/gosi': 'Calculate GOSI contributions',
          'POST /api/cvision/gosi/end-of-service': 'Calculate end of service benefits',
          'POST /api/cvision/gosi/nitaqat': 'Calculate Saudization percentage',
          'GET /api/cvision/gosi?action=rates': 'Get current rates',
        },
      },
    });
  } catch (error) {
    logger.error('GOSI API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { platformKey: 'cvision', permissionKey: 'cvision.gosi.read' });

// POST /api/cvision/gosi - Calculate GOSI contributions
export const POST = withAuthTenant(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { action } = body;

    // Calculate GOSI contributions
    if (!action || action === 'calculate') {
      const { baseSalary, housingAllowance = 0, includeHazard = false } = body;

      if (!baseSalary || baseSalary <= 0) {
        return NextResponse.json(
          { success: false, error: 'Basic salary is required and must be greater than zero' },
          { status: 400 }
        );
      }

      const calculation = calculateGOSI(baseSalary, housingAllowance, includeHazard);

      return NextResponse.json({
        success: true,
        data: {
          calculation,
          summary: `Employee: ${calculation.employeeContribution} SAR | Employer: ${calculation.employerContribution} SAR`,
        },
      });
    }

    // Calculate end of service
    if (action === 'end-of-service') {
      const {
        startDate,
        endDate,
        lastBasicSalary,
        lastHousingAllowance = 0,
        isResignation = false
      } = body;

      if (!startDate || !endDate || !lastBasicSalary) {
        return NextResponse.json(
          { success: false, error: 'Start date, end date, and basic salary are required' },
          { status: 400 }
        );
      }

      const calculation = calculateEndOfService(
        new Date(startDate),
        new Date(endDate),
        lastBasicSalary,
        lastHousingAllowance,
        isResignation
      );

      return NextResponse.json({
        success: true,
        data: {
          calculation,
          summary: `Service: ${calculation.yearsOfService.toFixed(1)} years | Amount: ${calculation.netAmount} SAR`,
        },
      });
    }

    // Calculate Nitaqat
    if (action === 'nitaqat') {
      const {
        saudiCount,
        nonSaudiCount,
        activityType = 'GENERAL',
        companySize = 'MEDIUM'
      } = body;

      if (saudiCount === undefined || nonSaudiCount === undefined) {
        return NextResponse.json(
          { success: false, error: 'Saudi and non-Saudi employee counts are required' },
          { status: 400 }
        );
      }

      const calculation = calculateNitaqat(
        saudiCount,
        nonSaudiCount,
        activityType,
        companySize
      );

      const statusLabels: Record<string, string> = {
        PLATINUM: 'Platinum',
        GREEN_HIGH: 'Green (High)',
        GREEN_MID: 'Green (Mid)',
        GREEN_LOW: 'Green (Low)',
        YELLOW: 'Yellow',
        RED: 'Red',
      };

      return NextResponse.json({
        success: true,
        data: {
          calculation,
          statusLabel: statusLabels[calculation.status],
          summary: `Saudization: ${calculation.saudizationPercentage}% | Status: ${calculation.status}`,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );

  } catch (error) {
    logger.error('GOSI API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { platformKey: 'cvision', permissionKey: 'cvision.gosi.calculate' });
