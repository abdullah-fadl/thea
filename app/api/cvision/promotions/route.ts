import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Promotions API
 *
 * GET  /api/cvision/promotions?action=...  — Read operations
 * POST /api/cvision/promotions              — Write operations (body.action)
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
  generateSequenceNumber,
} from '@/lib/cvision/db';
import {
  CVISION_PERMISSIONS,
  SEQUENCE_PREFIXES,
} from '@/lib/cvision/constants';
import {
  findEligibleEmployees,
  calculateNewSalary,
  buildGradeStructures,
  DEFAULT_GRADE_STRUCTURE,
  type GradeStructure,
  type EmployeeSnapshot,
  type PerformanceSnapshot,
} from '@/lib/cvision/promotions/promotion-engine';
import { getCVisionDb } from '@/lib/cvision/db';
import { onPromotionApproved } from '@/lib/cvision/lifecycle';
import type {
  CVisionPromotion,
  CVisionEmployee,
  CVisionDepartment,
  CVisionJobTitle,
  CVisionGrade,
  CVisionDisciplinary,
  CVisionPerformanceReview,
  PromotionSnapshot,
  PromotionProposed,
} from '@/lib/cvision/types';

/** Employee documents in MongoDB include denormalized salary/date fields */
type EmployeeDoc = CVisionEmployee & { basicSalary?: number; hireDate?: string | null };

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ───────── Shared helpers ─────────────────────────────────────────────── */

async function loadLookupMaps(tenantId: string) {
  const [deptCol, titleCol, gradeCol] = await Promise.all([
    getCVisionCollection<CVisionDepartment>(tenantId, 'departments'),
    getCVisionCollection<CVisionJobTitle>(tenantId, 'jobTitles'),
    getCVisionCollection<CVisionGrade>(tenantId, 'grades'),
  ]);
  const [departments, jobTitles, rawGrades] = await Promise.all([
    deptCol.find(createTenantFilter<CVisionDepartment>(tenantId, { deletedAt: { $exists: false } })).limit(500).toArray(),
    titleCol.find(createTenantFilter<CVisionJobTitle>(tenantId, { deletedAt: { $exists: false } })).limit(500).toArray(),
    gradeCol.find(createTenantFilter<CVisionGrade>(tenantId, { deletedAt: { $exists: false } })).limit(500).toArray(),
  ]);

  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));
  const titleMap = Object.fromEntries(jobTitles.map((t) => [t.id, t.name]));
  const gradeMap = Object.fromEntries(rawGrades.map((g) => [g.id, g.name || g.code || 'Unknown']));
  const grades = buildGradeStructures(rawGrades);

  return { departments, jobTitles, rawGrades, deptMap, titleMap, gradeMap, grades };
}

async function loadSmartData(tenantId: string, grades: GradeStructure[]) {
  const empCol = await getCVisionCollection<EmployeeDoc>(tenantId, 'employees');
  const employees = await empCol
    .find(createTenantFilter<EmployeeDoc>(tenantId, {
      status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] },
      isArchived: { $ne: true },
    }))
    .limit(5000)
    .toArray();

  // Warnings
  const warningsMap: Record<string, number> = {};
  try {
    const discCol = await getCVisionCollection<CVisionDisciplinary>(tenantId, 'disciplinary');
    const warnings = await discCol
      .find(createTenantFilter<CVisionDisciplinary>(tenantId, { isActive: true, status: { $in: ['ISSUED', 'ACKNOWLEDGED'] } }))
      .limit(5000)
      .toArray();
    for (const w of warnings) warningsMap[w.employeeId] = (warningsMap[w.employeeId] || 0) + 1;
  } catch { /* collection may not exist */ }

  // Performance reviews
  // The review document stores: finalScore (number 1-5), rating (label like "Exceptional")
  const performanceMap: Record<string, PerformanceSnapshot> = {};
  try {
    const revCol = await getCVisionCollection<CVisionPerformanceReview>(tenantId, 'performanceReviews');
    const reviews = await revCol
      .find(createTenantFilter<CVisionPerformanceReview>(tenantId, { status: { $in: ['MANAGER_REVIEW', 'CALIBRATION', 'COMPLETED'] } }))
      .limit(5000)
      .toArray();
    for (const r of reviews) {
      const score = r.finalScore || r.overallManagerScore || r.overallScore || 0;
      // Normalize the rating label ("Exceptional") → key ("EXCEPTIONAL")
      const rawRating: string = r.rating || '';
      const ratingKey = rawRating.toUpperCase().replace(/\s+/g, '_') || null;

      const existing = performanceMap[r.employeeId];
      if (!existing || score > (existing.overallScore || 0)) {
        performanceMap[r.employeeId] = { overallScore: score, rating: ratingKey };
      }
    }
  } catch { /* collection may not exist */ }

  // Last promotion date
  const lastPromoMap: Record<string, string> = {};
  try {
    const promoCol = await getCVisionCollection<CVisionPromotion>(tenantId, 'promotions');
    const promos = await promoCol
      .find(createTenantFilter<CVisionPromotion>(tenantId, { status: { $in: ['EFFECTIVE', 'APPROVED'] } }))
      .sort({ createdAt: -1 })
      .limit(5000)
      .toArray();
    for (const p of promos) {
      if (!lastPromoMap[p.employeeId]) lastPromoMap[p.employeeId] = p.createdAt;
    }
  } catch { /* collection may not exist */ }

  // Grade level lookup
  const gradeLevelMap = Object.fromEntries(grades.map((g) => [g.id, g.level]));

  return { employees, warningsMap, performanceMap, lastPromoMap, gradeLevelMap };
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* GET — Read operations                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

export const GET = withAuthTenant(
  async (request, { tenantId, userId, role }) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action') || 'list';
      const col = await getCVisionCollection<CVisionPromotion>(tenantId, 'promotions');

      // ── List ───────────────────────────────────────────────────────────
      if (action === 'list') {
        const query: any = createTenantFilter(tenantId);
        const status = searchParams.get('status');
        const type = searchParams.get('type');
        const department = searchParams.get('department');
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

        if (status) query.status = status;
        if (type) query.type = type;
        if (department) query['current.department'] = department;

        const total = await col.countDocuments(query);
        const items = await col.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray();

        return NextResponse.json({ success: true, data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
      }

      // ── Detail ─────────────────────────────────────────────────────────
      if (action === 'detail') {
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
        const record = await col.findOne(createTenantFilter<CVisionPromotion>(tenantId, { id }));
        if (!record) return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });
        return NextResponse.json({ success: true, data: record });
      }

      // ── Lookups (job titles, grades, departments for form dropdowns) ──
      if (action === 'lookups') {
        const { departments, jobTitles, rawGrades, grades } = await loadLookupMaps(tenantId);
        return NextResponse.json({
          success: true,
          data: {
            departments: departments.map((d) => ({ id: d.id, name: d.name || d.code || 'Unknown' })),
            jobTitles: jobTitles.map((t) => ({ id: t.id, name: t.name || t.code || 'Unknown', departmentId: t.departmentId })),
            grades: grades.map((g) => ({ id: g.id, name: g.name, code: g.code, level: g.level, minSalary: g.minSalary, midSalary: g.midSalary, maxSalary: g.maxSalary })),
          },
        });
      }

      // ── Smart recommendations (CORE FEATURE) ──────────────────────────
      if (action === 'recommendations') {
        const { deptMap, titleMap, gradeMap, grades } = await loadLookupMaps(tenantId);
        const { employees, warningsMap, performanceMap, lastPromoMap, gradeLevelMap } = await loadSmartData(tenantId, grades);

        const snapshots: EmployeeSnapshot[] = employees.map((emp) => ({
          id: emp.id,
          name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
          department: deptMap[emp.departmentId] || 'Unknown',
          departmentId: emp.departmentId,
          jobTitle: titleMap[emp.jobTitleId] || 'Unknown',
          jobTitleId: emp.jobTitleId,
          gradeId: emp.gradeId || null,
          grade: gradeMap[emp.gradeId] || null,
          gradeLevel: gradeLevelMap[emp.gradeId] || null,
          basicSalary: emp.basicSalary || 0,
          hireDate: emp.hireDate || null,
        }));

        const results = findEligibleEmployees(snapshots, performanceMap, warningsMap, lastPromoMap, grades);

        return NextResponse.json({ success: true, data: results, gradeStructure: grades });
      }

      // ── Calculate salary for a specific scenario ───────────────────────
      if (action === 'calc-salary') {
        const currentSalary = parseFloat(searchParams.get('currentSalary') || '0');
        const currentLevel = parseInt(searchParams.get('currentLevel') || '0', 10);
        const newLevel = parseInt(searchParams.get('newLevel') || '0', 10);

        const { grades } = await loadLookupMaps(tenantId);
        const result = calculateNewSalary(currentSalary, currentLevel, newLevel, grades);

        return NextResponse.json({ success: true, data: result });
      }

      // ── Stats ──────────────────────────────────────────────────────────
      if (action === 'stats') {
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString(), 10);
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year + 1, 0, 1);

        const allPromos = await col
          .find(createTenantFilter<CVisionPromotion>(tenantId, { createdAt: { $gte: startOfYear, $lt: endOfYear } }))
          .limit(5000)
          .toArray();

        const byStatus: Record<string, number> = {};
        const byType: Record<string, number> = {};
        const byDepartment: Record<string, number> = {};
        let totalIncrease = 0;
        let increaseCount = 0;

        for (const p of allPromos) {
          byStatus[p.status] = (byStatus[p.status] || 0) + 1;
          byType[p.type] = (byType[p.type] || 0) + 1;
          const dept = p.current?.department || 'Unknown';
          byDepartment[dept] = (byDepartment[dept] || 0) + 1;
          if (p.proposed?.salaryChange > 0) {
            totalIncrease += p.proposed.salaryChange;
            increaseCount++;
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            total: allPromos.length,
            byStatus, byType, byDepartment,
            avgSalaryIncrease: increaseCount > 0 ? Math.round(totalIncrease / increaseCount) : 0,
            approved: byStatus['APPROVED'] || 0,
            pending: byStatus['PENDING_APPROVAL'] || 0,
            effective: byStatus['EFFECTIVE'] || 0,
            rejected: byStatus['REJECTED'] || 0,
          },
        });
      }

      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (err: unknown) {
      logger.error('[Promotions GET]', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.promotions.read' }
);

/* ═══════════════════════════════════════════════════════════════════════════ */
/* POST — Write operations                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const { action } = body;
      const col = await getCVisionCollection<CVisionPromotion>(tenantId, 'promotions');

      // ── Create / propose ───────────────────────────────────────────────
      if (action === 'create') {
        const {
          employeeId, type, justification, achievements,
          proposedJobTitleId, proposedDepartmentId, proposedGradeId,
          proposedSalary, effectiveDate,
        } = body;

        if (!employeeId || !type || !justification) {
          return NextResponse.json({ error: 'employeeId, type, and justification are required' }, { status: 400 });
        }

        const empCol = await getCVisionCollection<EmployeeDoc>(tenantId, 'employees');
        const emp = await empCol.findOne(createTenantFilter<EmployeeDoc>(tenantId, { id: employeeId }));
        if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

        // Warnings count
        let activeWarnings = 0;
        try {
          const discCol = await getCVisionCollection<CVisionDisciplinary>(tenantId, 'disciplinary');
          activeWarnings = await discCol.countDocuments(
            createTenantFilter<CVisionDisciplinary>(tenantId, { employeeId, isActive: true, status: { $in: ['ISSUED', 'ACKNOWLEDGED'] } })
          );
        } catch { /* ignore */ }

        const { deptMap, titleMap, gradeMap } = await loadLookupMaps(tenantId);

        // Resolve proposed names
        const currentDept = deptMap[emp.departmentId] || 'Unknown';
        const currentTitle = titleMap[emp.jobTitleId] || 'Unknown';
        const currentGrade = gradeMap[emp.gradeId] || null;

        const propDept = proposedDepartmentId ? (deptMap[proposedDepartmentId] || currentDept) : currentDept;
        const propTitle = proposedJobTitleId ? (titleMap[proposedJobTitleId] || currentTitle) : currentTitle;
        const propGrade = proposedGradeId ? (gradeMap[proposedGradeId] || currentGrade) : currentGrade;

        const promotionNumber = await generateSequenceNumber(tenantId, SEQUENCE_PREFIXES.promotion);
        const finalSalary = proposedSalary || emp.basicSalary || 0;
        const salaryChange = finalSalary - (emp.basicSalary || 0);
        const salaryChangePercent = emp.basicSalary > 0 ? Math.round((salaryChange / emp.basicSalary) * 100) : 0;

        const now = new Date();
        const record = {
          id: uuidv4(), tenantId, promotionNumber,
          employeeId,
          employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
          employeeNumber: emp.employeeNo,
          type,
          justification,
          achievements: Array.isArray(achievements) ? achievements.filter((a: string) => a.trim()) : [],
          current: {
            department: currentDept, departmentId: emp.departmentId,
            jobTitle: currentTitle, jobTitleId: emp.jobTitleId,
            gradeId: emp.gradeId || null, grade: currentGrade,
            basicSalary: emp.basicSalary || 0,
          },
          proposed: {
            department: propDept, departmentId: proposedDepartmentId || emp.departmentId,
            jobTitle: propTitle, jobTitleId: proposedJobTitleId || emp.jobTitleId,
            gradeId: proposedGradeId || emp.gradeId || null, grade: propGrade,
            basicSalary: finalSalary, salaryChange, salaryChangePercent,
          },
          effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
          status: 'DRAFT',
          hasActiveWarnings: activeWarnings > 0,
          activeWarningsCount: activeWarnings,
          submittedBy: userId,
          submittedByName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || userId,
          approvals: [], comments: [],
          createdAt: now, updatedAt: now,
        };

        await col.insertOne(record);
        return NextResponse.json({ success: true, data: record });
      }

      // ── Submit for approval ────────────────────────────────────────────
      if (action === 'submit') {
        const { id } = body;
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
        const record = await col.findOne(createTenantFilter<CVisionPromotion>(tenantId, { id }));
        if (!record) return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });
        if (record.status !== 'DRAFT') return NextResponse.json({ error: `Cannot submit — status is ${record.status}` }, { status: 400 });

        await col.updateOne(createTenantFilter<CVisionPromotion>(tenantId, { id }), { $set: { status: 'PENDING_APPROVAL', submittedAt: new Date(), updatedAt: new Date() } });

        try {
          const notifCol = await getCVisionCollection<any>(tenantId, 'notifications');
          await notifCol.insertOne({
            id: uuidv4(), tenantId, type: 'PROMOTION_PENDING',
            title: 'Promotion Request Submitted',
            message: `Promotion ${record.promotionNumber} for ${record.employeeName} is pending approval.`,
            targetRoles: ['admin', 'hr-admin', 'thea-owner'], isRead: false, createdAt: new Date(),
          });
        } catch { /* ignore */ }

        return NextResponse.json({ success: true, message: 'Promotion submitted for approval' });
      }

      // ── Approve ────────────────────────────────────────────────────────
      if (action === 'approve') {
        if (!['admin', 'hr-admin', 'hr-manager', 'thea-owner', 'owner'].includes(role)) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        const { id, comments: approvalComments } = body;
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
        const record = await col.findOne(createTenantFilter<CVisionPromotion>(tenantId, { id }));
        if (!record) return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });
        if (record.status !== 'PENDING_APPROVAL') return NextResponse.json({ error: `Cannot approve — status is ${record.status}` }, { status: 400 });

        await col.updateOne(createTenantFilter<CVisionPromotion>(tenantId, { id }), {
          $set: { status: 'APPROVED', updatedAt: new Date() },
          $push: { approvals: { approvedBy: userId, approvedByName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || userId, approvedAt: new Date(), comments: approvalComments || '' } },
        } as Record<string, unknown>);
        return NextResponse.json({ success: true, message: 'Promotion approved' });
      }

      // ── Reject ─────────────────────────────────────────────────────────
      if (action === 'reject') {
        if (!['admin', 'hr-admin', 'hr-manager', 'thea-owner', 'owner'].includes(role)) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        const { id, reason } = body;
        if (!id || !reason) return NextResponse.json({ error: 'id and reason are required' }, { status: 400 });
        await col.updateOne(createTenantFilter<CVisionPromotion>(tenantId, { id }), { $set: { status: 'REJECTED', rejectionReason: reason, rejectedBy: userId, rejectedAt: new Date(), updatedAt: new Date() } });
        return NextResponse.json({ success: true, message: 'Promotion rejected' });
      }

      // ── Make effective ─────────────────────────────────────────────────
      if (action === 'make-effective') {
        if (!['admin', 'hr-admin', 'thea-owner', 'owner'].includes(role)) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        const { id } = body;
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
        const record = await col.findOne(createTenantFilter<CVisionPromotion>(tenantId, { id }));
        if (!record) return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });
        if (record.status !== 'APPROVED') return NextResponse.json({ error: `Cannot make effective — status is ${record.status}` }, { status: 400 });

        const empCol = await getCVisionCollection<EmployeeDoc>(tenantId, 'employees');
        const updateFields: any = { updatedAt: new Date() };
        if (record.proposed.jobTitleId !== record.current.jobTitleId) updateFields.jobTitleId = record.proposed.jobTitleId;
        if (record.proposed.departmentId !== record.current.departmentId) updateFields.departmentId = record.proposed.departmentId;
        if (record.proposed.gradeId !== record.current.gradeId) updateFields.gradeId = record.proposed.gradeId;
        if (record.proposed.basicSalary !== record.current.basicSalary) updateFields.basicSalary = record.proposed.basicSalary;

        if (Object.keys(updateFields).length > 1) {
          await empCol.updateOne(createTenantFilter<EmployeeDoc>(tenantId, { id: record.employeeId }), { $set: updateFields });
        }

        await col.updateOne(createTenantFilter<CVisionPromotion>(tenantId, { id }), {
          $set: { status: 'EFFECTIVE', effectiveDate: record.effectiveDate || new Date(), madeEffectiveBy: userId, madeEffectiveAt: new Date(), updatedAt: new Date() },
        });

        // Lifecycle: compensation, contract addendum, event dispatch
        const lifecycleDb = await getCVisionDb(tenantId);
        onPromotionApproved(lifecycleDb, tenantId, {
          id: record.id,
          employeeId: record.employeeId,
          employeeName: record.employeeName,
          newJobTitleId: record.proposed?.jobTitleId,
          newGradeId: record.proposed?.gradeId,
          newDepartmentId: record.proposed?.departmentId,
          newBasicSalary: record.proposed?.basicSalary,
          newHousingAllowance: record.proposed?.housingAllowance,
          newTransportAllowance: record.proposed?.transportAllowance,
          effectiveDate: record.effectiveDate,
          promotionNumber: record.promotionNumber,
        }, userId).catch(err => logger.error('[Lifecycle] onPromotionApproved failed:', err));

        return NextResponse.json({ success: true, message: 'Promotion is now effective — employee record updated' });
      }

      // ── Cancel ─────────────────────────────────────────────────────────
      if (action === 'cancel') {
        const { id, reason } = body;
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
        await col.updateOne(createTenantFilter<CVisionPromotion>(tenantId, { id }), { $set: { status: 'CANCELLED', cancellationReason: reason || '', cancelledBy: userId, cancelledAt: new Date(), updatedAt: new Date() } });
        return NextResponse.json({ success: true, message: 'Promotion cancelled' });
      }

      // ── Seed sample data ───────────────────────────────────────────────
      if (action === 'seed') {
        const existing = await col.countDocuments(createTenantFilter(tenantId));
        if (existing > 0) return NextResponse.json({ success: true, message: `Already ${existing} promotions — skipping seed`, seeded: 0 });

        // Also ensure grades have salary ranges
        const gradeCol = await getCVisionCollection<CVisionGrade>(tenantId, 'grades');
        const existingGrades = await gradeCol.countDocuments(createTenantFilter(tenantId));
        if (existingGrades === 0) {
          const now = new Date();
          const gradeSeeds = DEFAULT_GRADE_STRUCTURE.map((g) => ({
            id: uuidv4(), tenantId, ...g, isActive: true,
            createdAt: now, updatedAt: now, createdBy: userId, updatedBy: userId,
          }));
          await gradeCol.insertMany(gradeSeeds);
        }

        const { deptMap, titleMap, gradeMap, grades } = await loadLookupMaps(tenantId);
        const { employees } = await loadSmartData(tenantId, grades);

        if (employees.length < 3) {
          return NextResponse.json({ success: true, message: 'Not enough employees to seed promotions', seeded: 0 });
        }

        const now = new Date();
        const seeds: any[] = [];
        const mkBase = (emp: EmployeeDoc) => ({
          employeeId: emp.id,
          employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
          employeeNumber: emp.employeeNo,
          hasActiveWarnings: false, activeWarningsCount: 0,
          submittedBy: userId, submittedByName: 'HR Admin', comments: [],
        });

        const e1 = employees[0];
        const e1Title = titleMap[e1.jobTitleId] || 'Data Analyst';
        const e1Salary = e1.basicSalary || 5000;
        seeds.push({
          id: uuidv4(), tenantId, promotionNumber: 'PROMO-000001', ...mkBase(e1),
          type: 'PROMOTION',
          justification: 'Consistently exceeded KPIs for 12 months. Led the data migration project and mentored 2 junior analysts.',
          achievements: ['Led data migration project', 'Mentored 2 junior team members', 'Achieved 110% of quarterly KPIs'],
          current: { department: deptMap[e1.departmentId] || 'IT', departmentId: e1.departmentId, jobTitle: e1Title, jobTitleId: e1.jobTitleId, gradeId: e1.gradeId, grade: gradeMap[e1.gradeId] || 'G3', basicSalary: e1Salary },
          proposed: { department: deptMap[e1.departmentId] || 'IT', departmentId: e1.departmentId, jobTitle: `Senior ${e1Title}`, jobTitleId: e1.jobTitleId, gradeId: e1.gradeId, grade: gradeMap[e1.gradeId] || 'G4', basicSalary: Math.round(e1Salary * 1.4), salaryChange: Math.round(e1Salary * 0.4), salaryChangePercent: 40 },
          effectiveDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
          status: 'APPROVED',
          approvals: [{ approvedBy: userId, approvedByName: 'HR Director', approvedAt: new Date(now.getTime() - 3 * 86400000), comments: 'Well deserved.' }],
          createdAt: new Date(now.getTime() - 7 * 86400000), updatedAt: new Date(now.getTime() - 3 * 86400000),
        });

        const e2 = employees[1];
        const e2Salary = e2.basicSalary || 4500;
        seeds.push({
          id: uuidv4(), tenantId, promotionNumber: 'PROMO-000002', ...mkBase(e2),
          type: 'SALARY_ADJUSTMENT',
          justification: 'Annual market adjustment — current compensation 15% below market median.',
          achievements: ['Completed PMP certification', 'Reduced operational costs by 12%'],
          current: { department: deptMap[e2.departmentId] || 'Operations', departmentId: e2.departmentId, jobTitle: titleMap[e2.jobTitleId] || 'Specialist', jobTitleId: e2.jobTitleId, gradeId: e2.gradeId, grade: gradeMap[e2.gradeId] || 'G2', basicSalary: e2Salary },
          proposed: { department: deptMap[e2.departmentId] || 'Operations', departmentId: e2.departmentId, jobTitle: titleMap[e2.jobTitleId] || 'Specialist', jobTitleId: e2.jobTitleId, gradeId: e2.gradeId, grade: gradeMap[e2.gradeId] || 'G2', basicSalary: Math.round(e2Salary * 1.15), salaryChange: Math.round(e2Salary * 0.15), salaryChangePercent: 15 },
          effectiveDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
          status: 'PENDING_APPROVAL', approvals: [],
          createdAt: new Date(now.getTime() - 2 * 86400000), updatedAt: new Date(now.getTime() - 2 * 86400000),
        });

        const e3 = employees[2];
        seeds.push({
          id: uuidv4(), tenantId, promotionNumber: 'PROMO-000003', ...mkBase(e3),
          type: 'GRADE_UPGRADE',
          justification: 'Completed HR Management diploma. Ready for a grade upgrade.',
          achievements: ['Completed HR diploma', 'Managed cross-departmental initiative'],
          current: { department: deptMap[e3.departmentId] || 'Nursing', departmentId: e3.departmentId, jobTitle: titleMap[e3.jobTitleId] || 'Coordinator', jobTitleId: e3.jobTitleId, gradeId: e3.gradeId, grade: gradeMap[e3.gradeId] || 'G2', basicSalary: e3.basicSalary || 4000 },
          proposed: { department: deptMap[e3.departmentId] || 'Nursing', departmentId: e3.departmentId, jobTitle: titleMap[e3.jobTitleId] || 'Coordinator', jobTitleId: e3.jobTitleId, gradeId: e3.gradeId, grade: gradeMap[e3.gradeId] || 'G3', basicSalary: e3.basicSalary || 4000, salaryChange: 0, salaryChangePercent: 0 },
          effectiveDate: null, status: 'DRAFT', approvals: [],
          createdAt: new Date(now.getTime() - 86400000), updatedAt: new Date(now.getTime() - 86400000),
        });

        await col.insertMany(seeds);
        return NextResponse.json({ success: true, message: `Seeded ${seeds.length} sample promotions`, seeded: seeds.length });
      }

      // ── Seed grades ────────────────────────────────────────────────────
      if (action === 'seed-grades') {
        const gradeCol = await getCVisionCollection<CVisionGrade>(tenantId, 'grades');
        const existingGrades = await gradeCol.countDocuments(createTenantFilter(tenantId));
        if (existingGrades > 0) return NextResponse.json({ success: true, message: `Already ${existingGrades} grades`, seeded: 0 });

        const now = new Date();
        const gradeSeeds = DEFAULT_GRADE_STRUCTURE.map((g) => ({
          id: uuidv4(), tenantId, ...g, isActive: true,
          createdAt: now, updatedAt: now, createdBy: userId, updatedBy: userId,
        }));
        await gradeCol.insertMany(gradeSeeds);
        return NextResponse.json({ success: true, message: `Seeded ${gradeSeeds.length} grades (G1-G8)`, seeded: gradeSeeds.length });
      }

      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (err: unknown) {
      logger.error('[Promotions POST]', err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.promotions.write' }
);
