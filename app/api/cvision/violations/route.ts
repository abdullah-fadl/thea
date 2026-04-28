import { logger } from '@/lib/monitoring/logger';
// app/api/cvision/violations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireSessionAndTenant, middlewareError } from '@/lib/cvision/middleware';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  getRecommendedPenalty,
  countViolations,
  checkAbsenceTermination,
  calculateViolationDeductions,
  generateViolationReport,
  SAUDI_VIOLATION_PENALTIES,
  ViolationType,
} from '@/lib/cvision/violations';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireSessionAndTenant(request);
    if (!authResult.success || !authResult.data) {
      return middlewareError(authResult);
    }

    const { tenantId } = authResult.data;
    const { searchParams } = new URL(request.url);

    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const action = searchParams.get('action');

    const db = await getCVisionDb(tenantId);

    if (action === 'penalties-table') {
      return NextResponse.json({
        success: true,
        data: {
          penalties: SAUDI_VIOLATION_PENALTIES,
          severityLevels: {
            WARNING: 'Warning',
            MINOR: 'Minor',
            MAJOR: 'Major',
            CRITICAL: 'Critical',
          },
          statusLabels: {
            REPORTED: 'Reported',
            UNDER_INVESTIGATION: 'Under Investigation',
            PENDING_DECISION: 'Pending Decision',
            DECIDED: 'Decided',
            APPEALED: 'Appealed',
            CLOSED: 'Closed',
          },
        },
      });
    }

    if (action === 'report' && employeeId) {
      const fromDate = searchParams.get('from')
        ? new Date(searchParams.get('from')!)
        : new Date(new Date().getFullYear(), 0, 1);
      const toDate = searchParams.get('to')
        ? new Date(searchParams.get('to')!)
        : new Date();

      const violations = await db.collection('cvision_violations').find({
        tenantId,
        employeeId,
        incidentDate: { $gte: fromDate, $lte: toDate },
      }).limit(5000).toArray();

      const employee = await db.collection('cvision_employees').findOne({
        id: employeeId,
        tenantId,
      });

      const dailySalary = employee
        ? (employee.basicSalary + (employee.housingAllowance || 0)) / 30
        : 0;

      const report = generateViolationReport(
        employeeId,
        violations.map((v: any) => ({
          id: v._id.toString(),
          type: v.type,
          incidentDate: v.incidentDate,
          status: v.status,
          penalty: v.penalty,
          penaltyAmount: v.penaltyAmount,
          penaltyDays: v.penaltyDays,
        })),
        dailySalary,
        fromDate,
        toDate
      );

      return NextResponse.json({
        success: true,
        data: { report, violations },
      });
    }

    if (action === 'pending') {
      const pendingViolations = await db.collection('cvision_violations').find({
        tenantId,
        status: { $in: ['REPORTED', 'UNDER_INVESTIGATION', 'PENDING_DECISION'] },
      }).sort({ reportedDate: -1 }).limit(5000).toArray();

      return NextResponse.json({
        success: true,
        data: {
          violations: pendingViolations,
          total: pendingViolations.length,
        },
      });
    }

    if (action === 'stats') {
      const stats = await db.collection('cvision_violations').aggregate([
        { $match: { tenantId } },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalDeductions: { $sum: '$penaltyAmount' },
          },
        },
      ]).toArray();

      const byStatus = await db.collection('cvision_violations').aggregate([
        { $match: { tenantId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]).toArray();

      return NextResponse.json({
        success: true,
        data: { byType: stats, byStatus },
      });
    }

    const query: any = { tenantId };

    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;
    if (type) query.type = type;
    if (severity) query.severity = severity;

    const violations = await db.collection('cvision_violations')
      .find(query)
      .sort({ reportedDate: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({
      success: true,
      data: { violations, total: violations.length },
    });

  } catch (error) {
    logger.error('Violations API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

const VIOLATIONS_WRITE_ROLES = ['admin', 'hr-admin', 'hr-manager', 'super-admin', 'owner', 'thea-owner'];

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireSessionAndTenant(request);
    if (!authResult.success || !authResult.data) {
      return middlewareError(authResult);
    }

    const { tenantId, userId, role, cvisionRole } = authResult.data;

    // ── Role check: write operations require HR_MANAGER or ADMIN ──
    const effectiveRole = (cvisionRole || role || '').toLowerCase();
    if (!VIOLATIONS_WRITE_ROLES.includes(effectiveRole)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions: HR Manager or Admin role required' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    const db = await getCVisionDb(tenantId);

    if (action === 'recommend-penalty') {
      const { employeeId, violationType } = body;
      const previousViolations = await db.collection('cvision_violations').countDocuments({
        tenantId,
        employeeId,
        type: violationType,
        status: { $in: ['DECIDED', 'CLOSED'] },
      });

      const employee = await db.collection('cvision_employees').findOne({
        id: employeeId,
        tenantId,
      });

      const dailySalary = employee
        ? (employee.basicSalary + (employee.housingAllowance || 0)) / 30
        : 0;

      const recommendation = getRecommendedPenalty(
        violationType as ViolationType,
        previousViolations + 1,
        dailySalary
      );

      return NextResponse.json({
        success: true,
        data: {
          recommendation,
          occurrenceNumber: previousViolations + 1,
          previousViolations,
        },
      });
    }

    if (action === 'check-absence-termination') {
      const { employeeId } = body;

      const absences = await db.collection('cvision_attendance').find({
        tenantId,
        employeeId,
        status: 'ABSENT',
      }).limit(5000).toArray();

      const check = checkAbsenceTermination(
        absences.map((a: any) => ({
          date: a.date,
          isExcused: a.isExcused || false,
        }))
      );

      return NextResponse.json({
        success: true,
        data: check,
      });
    }

    if (action === 'calculate-deductions') {
      const { employeeId, month, year } = body;

      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);

      const violations = await db.collection('cvision_violations').find({
        tenantId,
        employeeId,
        status: { $in: ['DECIDED', 'CLOSED'] },
        decidedAt: { $gte: startOfMonth, $lte: endOfMonth },
      }).limit(5000).toArray();

      const employee = await db.collection('cvision_employees').findOne({
        id: employeeId,
        tenantId,
      });

      const dailySalary = employee
        ? (employee.basicSalary + (employee.housingAllowance || 0)) / 30
        : 0;

      const deductions = calculateViolationDeductions(
        violations.map((v: any) => ({
          id: v._id.toString(),
          type: v.type,
          penalty: v.penalty,
          penaltyAmount: v.penaltyAmount,
          penaltyDays: v.penaltyDays,
        })),
        dailySalary
      );

      return NextResponse.json({
        success: true,
        data: deductions,
      });
    }

    if (action === 'decide') {
      const { violationId, penalty, penaltyAmount, penaltyDays, decisionNotes } = body;

      const violation = await db.collection('cvision_violations').findOne({
        _id: violationId,
        tenantId,
      });

      if (!violation) {
        return NextResponse.json(
          { success: false, error: 'Violation not found' },
          { status: 404 }
        );
      }

      await db.collection('cvision_violations').updateOne(
        { tenantId, _id: violationId },
        {
          $set: {
            status: 'DECIDED',
            penalty,
            penaltyAmount: penaltyAmount || 0,
            penaltyDays: penaltyDays || 0,
            decisionNotes,
            decidedBy: userId,
            decidedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      return NextResponse.json({
        success: true,
        message: 'Decision recorded successfully',
      });
    }

    const {
      employeeId,
      type,
      severity,
      incidentDate,
      description,
      evidence = [],
      witnesses = [],
    } = body;

    if (!employeeId || !type || !severity || !incidentDate || !description) {
      return NextResponse.json(
        { success: false, error: 'All required fields must be filled' },
        { status: 400 }
      );
    }

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

    const violation = {
      tenantId,
      employeeId,
      type,
      severity,
      status: 'REPORTED',
      incidentDate: new Date(incidentDate),
      reportedDate: new Date(),
      reportedBy: userId,
      description,
      evidence,
      witnesses,
      investigationNotes: null,
      investigatedBy: null,
      investigatedAt: null,
      penalty: null,
      penaltyAmount: null,
      penaltyDays: null,
      decisionNotes: null,
      decidedBy: null,
      decidedAt: null,
      appealNotes: null,
      appealedAt: null,
      appealDecision: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('cvision_violations').insertOne(violation);

    return NextResponse.json({
      success: true,
      data: { id: result.insertedId, ...violation },
      message: 'Violation recorded successfully',
    });

  } catch (error) {
    logger.error('Violations API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
