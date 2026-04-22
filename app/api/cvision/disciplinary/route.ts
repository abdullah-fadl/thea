import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireSessionAndTenant, middlewareError } from '@/lib/cvision/middleware';
import { getCVisionDb } from '@/lib/cvision/db';
import { generateSequenceNumber } from '@/lib/cvision/db';
import { suggestWarningType, suggestActionText } from '@/lib/cvision/violations';
import type { CVisionDisciplinary, CVisionEmployee, CVisionDepartment, CVisionJobTitle } from '@/lib/cvision/types';

// ─── GET ────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireSessionAndTenant(request);
    if (!authResult.success || !authResult.data) {
      return middlewareError(authResult);
    }

    const { tenantId } = authResult.data;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const db = await getCVisionDb(tenantId);
    const col = db.collection('cvision_disciplinary');

    // ── List ──────────────────────────────────────────────────────────────────
    if (action === 'list') {
      const query: Record<string, any> = { tenantId };

      const status = searchParams.get('status');
      const type = searchParams.get('type');
      const severity = searchParams.get('severity');
      const category = searchParams.get('category');
      const department = searchParams.get('department');
      const employeeId = searchParams.get('employeeId');
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

      if (status) query.status = status;
      if (type) query.type = type;
      if (severity) query.severity = severity;
      if (category) query.category = category;
      if (department) query.department = department;
      if (employeeId) query.employeeId = employeeId;

      const total = await col.countDocuments(query);
      const items = await col
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      return NextResponse.json({
        success: true,
        data: { items, total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    }

    // ── Detail ────────────────────────────────────────────────────────────────
    if (action === 'detail') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

      const item = await col.findOne({ tenantId, warningNumber: id }) || await col.findOne({ tenantId, id });
      if (!item) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

      return NextResponse.json({ success: true, data: item });
    }

    // ── Employee history ──────────────────────────────────────────────────────
    if (action === 'employee-history') {
      const employeeId = searchParams.get('employeeId');
      if (!employeeId) return NextResponse.json({ success: false, error: 'employeeId required' }, { status: 400 });

      const items = await col.find({ tenantId, employeeId }).sort({ incidentDate: -1 }).limit(5000).toArray() as CVisionDisciplinary[];
      const activeCount = items.filter((w: CVisionDisciplinary) => w.isActive && !['REVOKED', 'EXPIRED'].includes(w.status)).length;

      return NextResponse.json({
        success: true,
        data: { items, total: items.length, activeCount },
      });
    }

    // ── Active warnings ──────────────────────────────────────────────────────
    if (action === 'active-warnings') {
      const items = await col
        .find({
          tenantId,
          isActive: true,
          status: { $nin: ['EXPIRED', 'REVOKED'] },
        })
        .sort({ createdAt: -1 })
        .limit(5000)
        .toArray();

      return NextResponse.json({ success: true, data: { items, total: items.length } });
    }

    // ── Stats ─────────────────────────────────────────────────────────────────
    if (action === 'stats') {
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1);

      const allThisYear = await col.find({ tenantId, createdAt: { $gte: yearStart } }).limit(5000).toArray() as CVisionDisciplinary[];
      const active = await col.find({ tenantId, isActive: true, status: { $nin: ['EXPIRED', 'REVOKED'] } }).limit(5000).toArray() as CVisionDisciplinary[];

      const byType: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      const byDepartment: Record<string, number> = {};
      const byMonth: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      const employeeWarningCount: Record<string, number> = {};

      for (const w of allThisYear) {
        byType[w.type] = (byType[w.type] || 0) + 1;
        byCategory[w.category] = (byCategory[w.category] || 0) + 1;
        byDepartment[w.department || 'Unknown'] = (byDepartment[w.department || 'Unknown'] || 0) + 1;
        bySeverity[w.severity] = (bySeverity[w.severity] || 0) + 1;
        const monthKey = new Date(w.createdAt).toISOString().slice(0, 7);
        byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
      }

      for (const w of active) {
        employeeWarningCount[w.employeeId] = (employeeWarningCount[w.employeeId] || 0) + 1;
      }

      const repeatOffenders = Object.entries(employeeWarningCount)
        .filter(([, c]) => c >= 2)
        .map(([empId, count]) => {
          const latest = active.find((w: CVisionDisciplinary) => w.employeeId === empId);
          return { employeeId: empId, employeeName: latest?.employeeName || empId, count, department: latest?.department };
        })
        .sort((a, b) => b.count - a.count);

      const pendingReview = active.filter((w: CVisionDisciplinary) => w.status === 'PENDING_REVIEW').length;
      const critical = active.filter((w: CVisionDisciplinary) => w.severity === 'CRITICAL').length;
      const acknowledged = allThisYear.filter((w: CVisionDisciplinary) => w.acknowledgedAt).length;
      const appealed = allThisYear.filter((w: CVisionDisciplinary) => w.status === 'APPEALED' || w.appealDate).length;

      const in30 = new Date();
      in30.setDate(in30.getDate() + 30);
      const expiringSoon = active.filter((w: CVisionDisciplinary) => w.expiryDate && new Date(w.expiryDate) <= in30).length;

      const uniqueEmployees = new Set(active.map((w: CVisionDisciplinary) => w.employeeId)).size;

      return NextResponse.json({
        success: true,
        data: {
          totalThisYear: allThisYear.length,
          activeWarnings: active.length,
          pendingReview,
          critical,
          expiringSoon,
          uniqueEmployees,
          acknowledgedRate: allThisYear.length > 0 ? Math.round((acknowledged / allThisYear.length) * 100) : 0,
          appealedRate: allThisYear.length > 0 ? Math.round((appealed / allThisYear.length) * 100) : 0,
          byType,
          byCategory,
          byDepartment,
          bySeverity,
          byMonth,
          repeatOffenders,
        },
      });
    }

    // ── Expiring soon ─────────────────────────────────────────────────────────
    if (action === 'expiring-soon') {
      const in30 = new Date();
      in30.setDate(in30.getDate() + 30);
      const items = await col
        .find({
          tenantId,
          isActive: true,
          status: { $nin: ['EXPIRED', 'REVOKED'] },
          expiryDate: { $lte: in30 },
        })
        .sort({ expiryDate: 1 })
        .limit(5000)
        .toArray();

      return NextResponse.json({ success: true, data: { items, total: items.length } });
    }

    // ── Escalation check ──────────────────────────────────────────────────────
    if (action === 'escalation-check') {
      const employeeId = searchParams.get('employeeId');
      if (!employeeId) return NextResponse.json({ success: false, error: 'employeeId required' }, { status: 400 });

      const activeWarnings = await col
        .find({
          tenantId,
          employeeId,
          isActive: true,
          status: { $nin: ['EXPIRED', 'REVOKED'] },
        })
        .sort({ createdAt: -1 })
        .limit(5000)
        .toArray();

      const suggestedType = suggestWarningType(activeWarnings.length);
      const suggestedAction = suggestActionText(suggestedType);

      return NextResponse.json({
        success: true,
        data: {
          activeWarnings: activeWarnings.length,
          escalationLevel: activeWarnings.length + 1,
          suggestedType,
          suggestedAction,
          previousWarnings: activeWarnings,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    logger.error('Disciplinary GET Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────────

const DISCIPLINARY_WRITE_ROLES = ['admin', 'hr-admin', 'hr-manager', 'super-admin', 'owner', 'thea-owner'];

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireSessionAndTenant(request);
    if (!authResult.success || !authResult.data) {
      return middlewareError(authResult);
    }

    const { tenantId, userId, role, cvisionRole } = authResult.data;
    const body = await request.json();
    const { action } = body;

    // ── Role check: write operations require HR_MANAGER or ADMIN ──
    // Allow 'acknowledge' and 'appeal' for the employee themselves (handled by action-level logic)
    const employeeSelfActions = ['acknowledge', 'appeal'];
    if (!employeeSelfActions.includes(action)) {
      const effectiveRole = (cvisionRole || role || '').toLowerCase();
      if (!DISCIPLINARY_WRITE_ROLES.includes(effectiveRole)) {
        return NextResponse.json({ success: false, error: 'Insufficient permissions: HR Manager or Admin role required' }, { status: 403 });
      }
    }

    const db = await getCVisionDb(tenantId);
    const col = db.collection('cvision_disciplinary');

    // ── Create warning ────────────────────────────────────────────────────────
    if (action === 'create') {
      const {
        employeeId,
        type,
        severity,
        category,
        incidentDate,
        incidentDescription,
        incidentDescriptionAr,
        location,
        witnesses,
        evidence,
        laborLawArticle,
        companyPolicyRef,
        actionTaken,
        actionTakenAr,
        suspensionDays,
        salaryDeduction,
        salaryDeductionPercentage,
      } = body;

      if (!employeeId || !type || !severity || !category || !incidentDate || !incidentDescription) {
        return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
      }

      const employee = await db.collection('cvision_employees').findOne({ id: employeeId, tenantId }) as CVisionEmployee | null;
      if (!employee) {
        return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
      }

      const dept = employee.departmentId
        ? await db.collection('cvision_departments').findOne({ id: employee.departmentId, tenantId }) as CVisionDepartment | null
        : null;
      const jt = employee.jobTitleId
        ? await db.collection('cvision_job_titles').findOne({ id: employee.jobTitleId, tenantId }) as CVisionJobTitle | null
        : null;

      const activeWarnings = await col.countDocuments({
        tenantId,
        employeeId,
        isActive: true,
        status: { $nin: ['EXPIRED', 'REVOKED'] },
      });

      const warningNumber = await generateSequenceNumber(tenantId, 'WARN');
      const expiryDate = new Date(incidentDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      const escalationMap: Record<string, number> = {
        VERBAL_WARNING: 1,
        FIRST_WRITTEN: 2,
        SECOND_WRITTEN: 3,
        FINAL_WARNING: 4,
        SUSPENSION: 5,
        TERMINATION: 6,
      };

      const record = {
        tenantId,
        warningNumber,
        employeeId,
        employeeName: employee.fullName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
        department: dept?.name || employee.departmentId || 'Unknown',
        jobTitle: jt?.name || 'N/A',
        type,
        severity,
        category,
        incidentDate: new Date(incidentDate),
        incidentDescription,
        incidentDescriptionAr: incidentDescriptionAr || '',
        location: location || null,
        witnesses: witnesses || [],
        evidence: evidence || [],
        laborLawArticle: laborLawArticle || null,
        companyPolicyRef: companyPolicyRef || null,
        previousWarnings: activeWarnings,
        escalationLevel: escalationMap[type] || 1,
        actionTaken: actionTaken || suggestActionText(type),
        actionTakenAr: actionTakenAr || '',
        suspensionDays: type === 'SUSPENSION' ? (suspensionDays || 0) : 0,
        salaryDeduction: salaryDeduction || 0,
        salaryDeductionPercentage: salaryDeductionPercentage || 0,
        status: 'DRAFT',
        acknowledgedAt: null,
        employeeResponse: null,
        appealDate: null,
        appealReason: null,
        appealDecision: null,
        appealDecidedBy: null,
        appealDecidedAt: null,
        expiryDate,
        isActive: true,
        issuedBy: userId,
        issuedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await col.insertOne(record);
      return NextResponse.json({ success: true, data: record }, { status: 201 });
    }

    // ── Issue (DRAFT → ISSUED) ────────────────────────────────────────────────
    if (action === 'issue') {
      const { warningNumber } = body;
      const warning = await col.findOne({ tenantId, warningNumber });
      if (!warning) return NextResponse.json({ success: false, error: 'Warning not found' }, { status: 404 });

      if (warning.status !== 'DRAFT' && warning.status !== 'PENDING_REVIEW') {
        return NextResponse.json({ success: false, error: `Cannot issue a warning in ${warning.status} status` }, { status: 400 });
      }

      await col.updateOne(
        { tenantId, warningNumber },
        {
          $set: {
            status: 'ISSUED',
            issuedAt: new Date(),
            issuedBy: userId,
            updatedAt: new Date(),
          },
        }
      );

      try {
        await db.collection('cvision_notifications').insertOne({
          tenantId,
          type: 'WARNING_ISSUED',
          title: 'Disciplinary Warning Issued',
          message: `A ${warning.type.replace(/_/g, ' ').toLowerCase()} has been issued to you.`,
          recipientEmployeeId: warning.employeeId,
          read: false,
          createdAt: new Date(),
        });
      } catch { /* non-critical */ }

      return NextResponse.json({ success: true, message: 'Warning issued successfully' });
    }

    // ── Acknowledge ───────────────────────────────────────────────────────────
    if (action === 'acknowledge') {
      const { warningNumber, employeeResponse } = body;
      const warning = await col.findOne({ tenantId, warningNumber });
      if (!warning) return NextResponse.json({ success: false, error: 'Warning not found' }, { status: 404 });

      await col.updateOne(
        { tenantId, warningNumber },
        {
          $set: {
            status: 'ACKNOWLEDGED',
            acknowledgedAt: new Date(),
            employeeResponse: employeeResponse || null,
            updatedAt: new Date(),
          },
        }
      );

      return NextResponse.json({ success: true, message: 'Warning acknowledged' });
    }

    // ── Appeal ────────────────────────────────────────────────────────────────
    if (action === 'appeal') {
      const { warningNumber, appealReason } = body;
      const warning = await col.findOne({ tenantId, warningNumber });
      if (!warning) return NextResponse.json({ success: false, error: 'Warning not found' }, { status: 404 });

      if (!['ISSUED', 'ACKNOWLEDGED'].includes(warning.status)) {
        return NextResponse.json({ success: false, error: 'Cannot appeal this warning' }, { status: 400 });
      }

      await col.updateOne(
        { tenantId, warningNumber },
        {
          $set: {
            status: 'APPEALED',
            appealDate: new Date(),
            appealReason: appealReason || '',
            updatedAt: new Date(),
          },
        }
      );

      return NextResponse.json({ success: true, message: 'Appeal filed successfully' });
    }

    // ── Decide appeal ─────────────────────────────────────────────────────────
    if (action === 'decide-appeal') {
      const { warningNumber, decision, decisionNotes } = body;
      const warning = await col.findOne({ tenantId, warningNumber });
      if (!warning) return NextResponse.json({ success: false, error: 'Warning not found' }, { status: 404 });

      if (warning.status !== 'APPEALED') {
        return NextResponse.json({ success: false, error: 'Warning is not under appeal' }, { status: 400 });
      }

      const approved = decision === 'APPROVED';
      await col.updateOne(
        { tenantId, warningNumber },
        {
          $set: {
            status: approved ? 'APPEAL_APPROVED' : 'APPEAL_REJECTED',
            appealDecision: decisionNotes || (approved ? 'Appeal approved' : 'Appeal rejected'),
            appealDecidedBy: userId,
            appealDecidedAt: new Date(),
            isActive: approved ? false : true,
            updatedAt: new Date(),
          },
        }
      );

      return NextResponse.json({ success: true, message: approved ? 'Appeal approved — warning revoked' : 'Appeal rejected' });
    }

    // ── Revoke ────────────────────────────────────────────────────────────────
    if (action === 'revoke') {
      const { warningNumber, reason } = body;
      const warning = await col.findOne({ tenantId, warningNumber });
      if (!warning) return NextResponse.json({ success: false, error: 'Warning not found' }, { status: 404 });

      await col.updateOne(
        { tenantId, warningNumber },
        {
          $set: {
            status: 'REVOKED',
            isActive: false,
            revokeReason: reason || '',
            updatedAt: new Date(),
          },
        }
      );

      return NextResponse.json({ success: true, message: 'Warning revoked' });
    }

    // ── Seed ──────────────────────────────────────────────────────────────────
    if (action === 'seed') {
      const existing = await col.countDocuments({ tenantId });
      if (existing > 0) {
        return NextResponse.json({ success: true, message: 'Seed data already exists', count: existing });
      }

      const employees = await db
        .collection('cvision_employees')
        .find({ tenantId, status: 'ACTIVE', deletedAt: null })
        .limit(10)
        .toArray();

      if (employees.length < 2) {
        return NextResponse.json({ success: false, error: 'Need at least 2 active employees to seed' }, { status: 400 });
      }

      const emp1 = employees[0] as CVisionEmployee;
      const emp2 = employees[1] as CVisionEmployee;
      const emp3 = (employees[2] as CVisionEmployee) || emp1;

      const dept1 = emp1.departmentId
        ? await db.collection('cvision_departments').findOne({ id: emp1.departmentId, tenantId }) as CVisionDepartment | null
        : null;
      const dept2 = emp2.departmentId
        ? await db.collection('cvision_departments').findOne({ id: emp2.departmentId, tenantId }) as CVisionDepartment | null
        : null;

      const getName = (e: CVisionEmployee) => e.fullName || `${e.firstName || ''} ${e.lastName || ''}`.trim() || 'Unknown';

      const now = new Date();
      const seedWarnings = [
        {
          tenantId,
          warningNumber: 'WARN-000001',
          employeeId: emp1.id,
          employeeName: getName(emp1),
          department: dept1?.name || 'Operations',
          jobTitle: (emp1 as any).jobTitle || (emp1 as any).positionTitle || 'Staff',
          type: 'VERBAL_WARNING',
          severity: 'MINOR',
          category: 'PERFORMANCE',
          incidentDate: new Date(now.getFullYear() - 1, now.getMonth(), 5),
          incidentDescription: 'Missed project deadline without prior notification',
          incidentDescriptionAr: '',
          location: 'Office',
          witnesses: [],
          evidence: [],
          laborLawArticle: 'Article 66',
          companyPolicyRef: null,
          previousWarnings: 0,
          escalationLevel: 1,
          actionTaken: 'Verbal counseling provided. Employee reminded of company policy and expected standards of conduct.',
          actionTakenAr: '',
          suspensionDays: 0,
          salaryDeduction: 0,
          salaryDeductionPercentage: 0,
          status: 'EXPIRED',
          acknowledgedAt: new Date(now.getFullYear() - 1, now.getMonth(), 6),
          employeeResponse: 'Understood and will improve.',
          appealDate: null,
          appealReason: null,
          appealDecision: null,
          appealDecidedBy: null,
          appealDecidedAt: null,
          expiryDate: new Date(now.getFullYear(), now.getMonth(), 5),
          isActive: false,
          issuedBy: userId,
          issuedAt: new Date(now.getFullYear() - 1, now.getMonth(), 5),
          createdAt: new Date(now.getFullYear() - 1, now.getMonth(), 5),
          updatedAt: new Date(now.getFullYear() - 1, now.getMonth(), 6),
        },
        {
          tenantId,
          warningNumber: 'WARN-000002',
          employeeId: emp1.id,
          employeeName: getName(emp1),
          department: dept1?.name || 'Operations',
          jobTitle: (emp1 as any).jobTitle || (emp1 as any).positionTitle || 'Staff',
          type: 'FIRST_WRITTEN',
          severity: 'MODERATE',
          category: 'ATTENDANCE',
          incidentDate: new Date(now.getFullYear(), now.getMonth() - 1, 10),
          incidentDescription: 'Late arrival 3 times in one week without justification',
          incidentDescriptionAr: '',
          location: 'Office',
          witnesses: [],
          evidence: [],
          laborLawArticle: 'Article 66',
          companyPolicyRef: 'Attendance Policy v2',
          previousWarnings: 1,
          escalationLevel: 2,
          actionTaken: 'First written warning issued. Employee must demonstrate improvement within 30 days.',
          actionTakenAr: '',
          suspensionDays: 0,
          salaryDeduction: 0,
          salaryDeductionPercentage: 0,
          status: 'ACKNOWLEDGED',
          acknowledgedAt: new Date(now.getFullYear(), now.getMonth() - 1, 12),
          employeeResponse: 'I acknowledge the warning.',
          appealDate: null,
          appealReason: null,
          appealDecision: null,
          appealDecidedBy: null,
          appealDecidedAt: null,
          expiryDate: new Date(now.getFullYear() + 1, now.getMonth() - 1, 10),
          isActive: true,
          issuedBy: userId,
          issuedAt: new Date(now.getFullYear(), now.getMonth() - 1, 10),
          createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 10),
          updatedAt: new Date(now.getFullYear(), now.getMonth() - 1, 12),
        },
        {
          tenantId,
          warningNumber: 'WARN-000003',
          employeeId: emp2.id,
          employeeName: getName(emp2),
          department: dept2?.name || 'HR',
          jobTitle: (emp2 as any).jobTitle || (emp2 as any).positionTitle || 'Staff',
          type: 'VERBAL_WARNING',
          severity: 'MINOR',
          category: 'PERFORMANCE',
          incidentDate: new Date(now.getFullYear(), now.getMonth(), 1),
          incidentDescription: 'Failed to complete assigned training modules by the due date',
          incidentDescriptionAr: '',
          location: null,
          witnesses: [],
          evidence: [],
          laborLawArticle: null,
          companyPolicyRef: 'Training Compliance Policy',
          previousWarnings: 0,
          escalationLevel: 1,
          actionTaken: 'Verbal counseling provided. Employee reminded of company policy and expected standards of conduct.',
          actionTakenAr: '',
          suspensionDays: 0,
          salaryDeduction: 0,
          salaryDeductionPercentage: 0,
          status: 'ISSUED',
          acknowledgedAt: null,
          employeeResponse: null,
          appealDate: null,
          appealReason: null,
          appealDecision: null,
          appealDecidedBy: null,
          appealDecidedAt: null,
          expiryDate: new Date(now.getFullYear() + 1, now.getMonth(), 1),
          isActive: true,
          issuedBy: userId,
          issuedAt: new Date(now.getFullYear(), now.getMonth(), 1),
          createdAt: new Date(now.getFullYear(), now.getMonth(), 1),
          updatedAt: new Date(now.getFullYear(), now.getMonth(), 1),
        },
        {
          tenantId,
          warningNumber: 'WARN-000004',
          employeeId: emp3.id,
          employeeName: getName(emp3),
          department: dept1?.name || 'Operations',
          jobTitle: (emp3 as any).jobTitle || (emp3 as any).positionTitle || 'Staff',
          type: 'VERBAL_WARNING',
          severity: 'MINOR',
          category: 'CONDUCT',
          incidentDate: new Date(now.getFullYear(), now.getMonth() - 1, 20),
          incidentDescription: 'Inappropriate language used during team meeting',
          incidentDescriptionAr: '',
          location: 'Conference Room A',
          witnesses: ['Team Lead'],
          evidence: [],
          laborLawArticle: 'Article 66',
          companyPolicyRef: 'Code of Conduct',
          previousWarnings: 0,
          escalationLevel: 1,
          actionTaken: 'Verbal counseling provided. Employee reminded of company policy and expected standards of conduct.',
          actionTakenAr: '',
          suspensionDays: 0,
          salaryDeduction: 0,
          salaryDeductionPercentage: 0,
          status: 'APPEALED',
          acknowledgedAt: null,
          employeeResponse: null,
          appealDate: new Date(now.getFullYear(), now.getMonth() - 1, 22),
          appealReason: 'The language was taken out of context during a heated discussion.',
          appealDecision: null,
          appealDecidedBy: null,
          appealDecidedAt: null,
          expiryDate: new Date(now.getFullYear() + 1, now.getMonth() - 1, 20),
          isActive: true,
          issuedBy: userId,
          issuedAt: new Date(now.getFullYear(), now.getMonth() - 1, 20),
          createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 20),
          updatedAt: new Date(now.getFullYear(), now.getMonth() - 1, 22),
        },
      ];

      await col.insertMany(seedWarnings);

      // Update the sequence counter so future warnings continue from 5
      // PG columns: entityType (unique key), prefix (NOT NULL), currentValue
      const seqCol = db.collection('cvision_sequences');
      await seqCol.updateOne(
        { tenantId, entityType: 'WARN' },
        { $set: { currentValue: 4, prefix: 'WARN', entityType: 'WARN' } },
        { upsert: true }
      );

      return NextResponse.json({ success: true, message: `Seeded ${seedWarnings.length} disciplinary records`, count: seedWarnings.length });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    logger.error('Disciplinary POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
