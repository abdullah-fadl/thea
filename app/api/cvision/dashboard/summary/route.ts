import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb, getCVisionCollection, createTenantFilter } from '@/lib/cvision/db';
import { requireCtx } from '@/lib/cvision/authz/enforce';
import type { CVisionDepartment, CVisionEmployee } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const db = await getCVisionDb(tenantId);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 86400000);

  // ── Core employee metrics ────────────────────────────────────────────────
  const [
    totalEmployees, activeEmployees, probationEmployees,
    newThisMonth, resignedThisMonth, saudiCount,
  ] = await Promise.all([
    db.collection('cvision_employees').countDocuments({ tenantId, isArchived: { $ne: true }, deletedAt: null }),
    db.collection('cvision_employees').countDocuments({ tenantId, status: 'ACTIVE', isArchived: { $ne: true }, deletedAt: null }),
    db.collection('cvision_employees').countDocuments({ tenantId, status: 'PROBATION', isArchived: { $ne: true }, deletedAt: null }),
    db.collection('cvision_employees').countDocuments({ tenantId, isArchived: { $ne: true }, deletedAt: null, hiredAt: { $gte: thirtyDaysAgo } }),
    db.collection('cvision_employees').countDocuments({ tenantId, status: 'RESIGNED', isArchived: { $ne: true }, deletedAt: null, updatedAt: { $gte: thirtyDaysAgo } }),
    db.collection('cvision_employees').countDocuments({ tenantId, nationality: { $regex: /saudi/i }, status: { $in: ['ACTIVE', 'PROBATION'] }, isArchived: { $ne: true }, deletedAt: null }),
  ]);

  // ── Pending approvals ────────────────────────────────────────────────────
  const [pendingLeaves, pendingLoans, pendingLetters] = await Promise.all([
    db.collection('cvision_leaves').countDocuments({ tenantId, status: 'PENDING' }),
    db.collection('cvision_loans').countDocuments({ tenantId, status: 'PENDING' }),
    db.collection('cvision_letters').countDocuments({ tenantId, status: 'PENDING' }),
  ]);

  // ── Expiry alerts (use metadata JSONB for iqama/passport, contractEndDate for contracts) ──
  const [contractExpiring] = await Promise.all([
    db.collection('cvision_employees').countDocuments({ tenantId, status: 'ACTIVE', isArchived: { $ne: true }, deletedAt: null, contractEndDate: { $lte: thirtyDaysFromNow, $gte: now } }),
  ]);

  // ── Leave stats ──────────────────────────────────────────────────────────
  const onLeaveToday = await db.collection('cvision_leaves').countDocuments({
    tenantId, status: 'APPROVED',
    startDate: { $lte: now }, endDate: { $gte: now },
  });

  // ── Department count ─────────────────────────────────────────────────────
  const deptCollection = await getCVisionCollection<CVisionDepartment>(tenantId, 'departments');
  const departmentCount = await deptCollection.countDocuments(
    createTenantFilter(tenantId, { isActive: { $ne: false } } as Record<string, unknown>)
  );

  // ── Training stats ───────────────────────────────────────────────────────
  const [activeCourses, totalEnrollments, completedEnrollments] = await Promise.all([
    db.collection('cvision_training_courses').countDocuments({ tenantId, isActive: true }).catch(() => 0),
    db.collection('cvision_training_enrollments').countDocuments({ tenantId }).catch(() => 0),
    db.collection('cvision_training_enrollments').countDocuments({ tenantId, status: 'COMPLETED' }).catch(() => 0),
  ]);

  // ── Attendance today ─────────────────────────────────────────────────────
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const presentToday = await db.collection('cvision_attendance').countDocuments({
    tenantId, date: { $gte: todayStart, $lt: new Date(todayStart.getTime() + 86400000) },
  }).catch(() => 0);

  // ── Loan stats ───────────────────────────────────────────────────────────
  const activeLoans = await db.collection('cvision_loans').countDocuments({
    tenantId, status: 'ACTIVE',
  }).catch(() => 0);

  // ── Open positions (recruitment) ─────────────────────────────────────────
  const openPositions = await db.collection('cvision_job_requisitions').countDocuments({
    tenantId, status: { $in: ['OPEN', 'APPROVED'] },
  }).catch(() => 0);

  // ── Recent announcements ─────────────────────────────────────────────────
  const recentAnnouncements = await db.collection('cvision_announcements')
    .find({ tenantId }).sort({ createdAt: -1 }).limit(3)
    .project({ title: 1, content: 1, createdAt: 1 }).toArray();

  // ── Recent hires (resolve names and departments) ─────────────────────────
  const recentHiresRaw = await db.collection('cvision_employees')
    .find({ tenantId, isArchived: { $ne: true }, deletedAt: null, hiredAt: { $gte: thirtyDaysAgo } })
    .sort({ hiredAt: -1 }).limit(5)
    .project({ id: 1, firstName: 1, lastName: 1, fullName: 1, departmentId: 1, jobTitleId: 1, hiredAt: 1 })
    .toArray();

  const hireDeptIds = [...new Set(recentHiresRaw.map(h => h.departmentId).filter(Boolean))];
  const hireDeptDocs = hireDeptIds.length > 0
    ? await db.collection('cvision_departments').find({ tenantId, id: { $in: hireDeptIds } }).project({ id: 1, name: 1 }).toArray()
    : [];
  const hireDeptMap = new Map(hireDeptDocs.map(d => [d.id, d.name]));

  const recentHires = recentHiresRaw.map(h => ({
    name: h.fullName || `${h.firstName || ''} ${h.lastName || ''}`.trim() || 'Unknown',
    departmentName: hireDeptMap.get(h.departmentId) || h.departmentId || 'Unassigned',
    jobTitle: h.jobTitleId || '-',
    joinDate: h.hiredAt,
  }));

  // ── Recent activity (from audit logs) ────────────────────────────────────
  const recentActivityRaw = await db.collection('cvision_audit_logs')
    .find({ tenantId })
    .sort({ createdAt: -1 }).limit(8)
    .project({ action: 1, resourceType: 1, actorEmail: 1, actorUserId: 1, createdAt: 1, metadata: 1 })
    .toArray().catch(() => []);

  const actorIds = [...new Set(recentActivityRaw.map(a => a.actorUserId).filter(Boolean))];
  const actorEmps = actorIds.length > 0
    ? await db.collection('cvision_employees').find({ tenantId, id: { $in: actorIds }, deletedAt: null }).project({ id: 1, firstName: 1, lastName: 1 }).toArray().catch(() => [])
    : [];
  const actorMap = new Map(actorEmps.map(e => [e.id, `${e.firstName || ''} ${e.lastName || ''}`.trim()]));

  const recentActivity = recentActivityRaw.map(a => ({
    action: a.action,
    resourceType: a.resourceType,
    actorName: actorMap.get(a.actorUserId) || a.actorEmail || 'System',
    createdAt: a.createdAt,
  }));

  // ── Self-service data ────────────────────────────────────────────────────
  const [myPendingRequests, myUnreadNotifications] = await Promise.all([
    db.collection('cvision_requests').countDocuments({ tenantId, requesterId: ctx.userId, status: 'OPEN' }).catch(() => 0),
    db.collection('cvision_notifications').countDocuments({ tenantId, recipientId: ctx.userId, read: false }).catch(() => 0),
  ]);

  // ── Recent leave requests (real data) ────────────────────────────────────
  const recentLeavesRaw = await db.collection('cvision_leaves')
    .find({ tenantId, deletedAt: null }).sort({ createdAt: -1 }).limit(5)
    .project({ employeeId: 1, leaveType: 1, startDate: 1, endDate: 1, days: 1, status: 1 })
    .toArray().catch(() => []);
  const leaveEmpIds = [...new Set(recentLeavesRaw.map(l => l.employeeId).filter(Boolean))];
  const leaveEmpDocs = leaveEmpIds.length > 0
    ? await db.collection('cvision_employees').find({ tenantId, id: { $in: leaveEmpIds }, deletedAt: null })
        .project({ id: 1, firstName: 1, lastName: 1, fullName: 1, firstNameAr: 1, lastNameAr: 1 }).toArray().catch(() => [])
    : [];
  const leaveEmpMap = new Map(leaveEmpDocs.map(e => [e.id, {
    name: e.fullName || `${e.firstName || ''} ${e.lastName || ''}`.trim() || 'Employee',
    nameAr: `${e.firstNameAr || e.firstName || ''} ${e.lastNameAr || e.lastName || ''}`.trim() || '',
  }]));
  const recentLeaves = recentLeavesRaw.map(l => ({
    employeeName: leaveEmpMap.get(l.employeeId)?.name || 'Employee',
    employeeNameAr: leaveEmpMap.get(l.employeeId)?.nameAr || '',
    type: l.leaveType || 'ANNUAL',
    startDate: l.startDate,
    endDate: l.endDate,
    days: l.days || 0,
    status: l.status || 'PENDING',
  }));

  // ── Department headcounts (real data) ──────────────────────────────────
  const deptAgg = await db.collection('cvision_employees').aggregate([
    { $match: { tenantId, isArchived: { $ne: true }, deletedAt: null, status: { $in: ['ACTIVE', 'PROBATION'] } } },
    { $group: { _id: '$departmentId', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray().catch(() => []);
  const deptIds = deptAgg.map(d => d._id).filter(Boolean);
  const deptNameDocs = deptIds.length > 0
    ? await db.collection('cvision_departments').find({ tenantId, id: { $in: deptIds } })
        .project({ id: 1, name: 1, nameAr: 1 }).toArray().catch(() => [])
    : [];
  const deptNameMap = new Map(deptNameDocs.map(d => [d.id, { name: d.name || d.id, nameAr: d.nameAr || '' }]));
  const departmentHeadcounts = deptAgg.map(d => ({
    name: deptNameMap.get(d._id)?.name || d._id || 'Unassigned',
    nameAr: deptNameMap.get(d._id)?.nameAr || '',
    count: d.count,
  }));

  // ── Recruitment pipeline (real data) ───────────────────────────────────
  const candidateAgg = await db.collection('cvision_candidates').aggregate([
    { $match: { tenantId } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ] as any).toArray().catch(() => []);
  const candidateMap = new Map<string, number>(candidateAgg.map((c: any) => [c._id, c.count] as [string, number]));
  const recruitmentPipeline = [
    { stage: 'Applied', stageAr: 'تقديم', count: (candidateMap.get('APPLIED') || 0) + (candidateMap.get('NEW') || 0) },
    { stage: 'Screened', stageAr: 'فرز', count: (candidateMap.get('SCREENED') || 0) + (candidateMap.get('SHORTLISTED') || 0) + (candidateMap.get('SCREENING') || 0) },
    { stage: 'Interview', stageAr: 'مقابلة', count: candidateMap.get('INTERVIEW') || 0 },
    { stage: 'Offered', stageAr: 'عرض', count: candidateMap.get('OFFER') || 0 },
    { stage: 'Hired', stageAr: 'تعيين', count: candidateMap.get('HIRED') || 0 },
  ];

  // ── Payroll summary (real data from contracts) ──────────────────────────
  const payrollAgg = await db.collection('cvision_contracts').aggregate([
    { $match: { tenantId, isActive: true, status: 'ACTIVE' } },
    { $group: {
      _id: null,
      basicTotal: { $sum: '$basicSalary' },
      housingTotal: { $sum: '$housingAllowance' },
      transportTotal: { $sum: '$transportAllowance' },
      otherTotal: { $sum: '$otherAllowances' },
    }},
  ]).toArray().catch(() => []);
  const payrollRow = payrollAgg[0] || {};
  const basicTotal = Number(payrollRow.basicTotal) || 0;
  const housingTotal = Number(payrollRow.housingTotal) || 0;
  const transportTotal = Number(payrollRow.transportTotal) || 0;
  const otherTotal = Number(payrollRow.otherTotal) || 0;
  const totalPayroll = basicTotal + housingTotal + transportTotal + otherTotal;
  const gosiTotal = Math.round(basicTotal * 0.0975); // Employer GOSI ~9.75%
  const deductionsTotal = Math.round(basicTotal * 0.1); // Employee GOSI ~10%
  const payrollSummary = { totalPayroll, basicTotal, housingTotal, transportTotal, gosiTotal, deductionsTotal };

  // ── Compute derived values ───────────────────────────────────────────────
  const activeAndProbation = activeEmployees + probationEmployees;
  const saudizationPercent = activeAndProbation > 0 ? Math.round((saudiCount / activeAndProbation) * 100) : 0;
  const pendingApprovals = pendingLeaves + pendingLoans + pendingLetters;

  const expiryAlerts = [];
  if (contractExpiring > 0) expiryAlerts.push({ type: 'contract', count: contractExpiring, label: 'Contracts expiring within 30 days' });

  return NextResponse.json({
    ok: true,
    data: {
      totalEmployees, activeEmployees, probationEmployees, newThisMonth, resignedThisMonth, saudizationPercent,
      pendingApprovals, pendingLeaves, pendingLoans, pendingLetters,
      expiryAlerts,
      departmentCount, openPositions,
      leaveStats: { onLeaveToday, pendingRequests: pendingLeaves },
      training: { activeCourses, totalEnrollments, completedEnrollments },
      presentToday,
      activeLoans,
      recentAnnouncements, recentHires, recentActivity,
      myPendingRequests, myUnreadNotifications,
      recentLeaves, departmentHeadcounts, recruitmentPipeline, payrollSummary,
    },
  });
},
  { platformKey: 'cvision', permissionKey: 'cvision.dashboards.read' });
